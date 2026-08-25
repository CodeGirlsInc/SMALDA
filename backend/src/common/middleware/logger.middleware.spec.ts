import { LoggerMiddleware } from './logger.middleware';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Test } from '@nestjs/testing';
import { Logger } from 'winston';
import { Request, Response } from 'express';
import { AccessLogsService } from '../../access-logs/access-logs.service';

describe('LoggerMiddleware', () => {
  let middleware: LoggerMiddleware;
  let mockLogger: { info: jest.Mock; error: jest.Mock };
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(async () => {
    mockLogger = { info: jest.fn(), error: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        LoggerMiddleware,
        {
          provide: WINSTON_MODULE_NEST_PROVIDER,
          useValue: mockLogger,
        },
        {
          provide: AccessLogsService,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    middleware = module.get<LoggerMiddleware>(LoggerMiddleware);
    mockRequest = {
      headers: {},
      originalUrl: '/test',
      method: 'GET',
    };
    mockResponse = {
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          callback();
        }
      }),
      statusCode: 200,
    };
    nextFunction = jest.fn();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should log request details including correlation ID', () => {
    mockRequest.headers['x-request-id'] = 'test-id';
    (mockRequest as any).requestId = 'test-id';
    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'http-request',
      expect.objectContaining({
        method: 'GET',
        path: '/test',
        status: 200,
        requestId: 'test-id',
      }),
    );
  });

  it('should not log sensitive headers', () => {
    mockRequest.headers['authorization'] = 'Bearer token';
    mockRequest.headers['cookie'] = 'secret=cookie';
    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction,
    );
    const logObject = mockLogger.info.mock.calls[0][1];
    expect(logObject).not.toHaveProperty('headers.authorization');
    expect(logObject).not.toHaveProperty('headers.cookie');
  });
});
