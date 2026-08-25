import { HttpExceptionFilter } from './http-exception.filter';
import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockHost: ArgumentsHost;
  let mockResponse: any;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({ url: '/test', method: 'GET' }),
      }),
    } as any;
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should handle HttpException', () => {
    const exception = new HttpException(
      'Test Exception',
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(responseBody.message).toBe('Test Exception');
    expect(responseBody.path).toBe('/test');
    expect(responseBody).not.toHaveProperty('stack');
  });

  it('should handle generic Error', () => {
    const exception = new Error('Generic Error');
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(responseBody.message).toBe('Generic Error');
    expect(responseBody).not.toHaveProperty('stack');
  });

  it('should handle BadRequestException from validation pipe', () => {
    const exception = new BadRequestException({
      message: ['field must be a string'],
      error: 'Bad Request',
      statusCode: 400,
    });
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody.message).toBe('field must be a string');
  });

  it('should not include stack trace in production', () => {
    const prodFilter = new HttpExceptionFilter(true);
    const exception = new Error('Generic Error');
    prodFilter.catch(exception, mockHost);
    const responseBody = mockResponse.json.mock.calls[0][0];
    expect(responseBody).not.toHaveProperty('stack');
  });
});
