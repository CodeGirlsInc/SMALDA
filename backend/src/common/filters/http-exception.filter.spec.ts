import { HttpExceptionFilter } from './http-exception.filter';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('HttpExceptionFilter', () => {
  const mockResponse = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const mockRequest = (overrides = {}) =>
    ({
      method: 'POST',
      url: '/auth/login',
      requestId: 'req-123',
      ...overrides,
    }) as any;

  const mockHost = (req: any, res: any) =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    }) as any;

  it('should pass through non-sensitive error messages', () => {
    const filter = new HttpExceptionFilter(true);
    const res = mockResponse();
    const req = mockRequest();
    const exception = new HttpException(
      { message: 'Email already registered' },
      HttpStatus.CONFLICT,
    );

    filter.catch(exception, mockHost(req, res));

    expect(res.status).toHaveBeenCalledWith(409);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Email already registered');
  });

  it('should sanitize sensitive error messages in production', () => {
    const filter = new HttpExceptionFilter(true);
    const res = mockResponse();
    const req = mockRequest();
    const exception = new HttpException(
      { message: 'ER_DUP_ENTRY: Duplicate entry for key' },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    filter.catch(exception, mockHost(req, res));

    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe(
      'An unexpected error occurred. Please try again later.',
    );
  });

  it('should NOT sanitize in non-production mode', () => {
    const filter = new HttpExceptionFilter(false);
    const res = mockResponse();
    const req = mockRequest();
    const exception = new HttpException(
      { message: 'ER_DUP_ENTRY: Duplicate entry' },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    filter.catch(exception, mockHost(req, res));

    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('ER_DUP_ENTRY: Duplicate entry');
  });

  it('should handle generic Error instances', () => {
    const filter = new HttpExceptionFilter(false);
    const res = mockResponse();
    const req = mockRequest();
    const exception = new Error('Something went wrong');

    filter.catch(exception, mockHost(req, res));

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.stack).toBeDefined();
  });

  it('should sanitize database connection errors in production', () => {
    const filter = new HttpExceptionFilter(true);
    const res = mockResponse();
    const req = mockRequest();
    const exception = new HttpException(
      { message: 'connect ECONNREFUSED 127.0.0.1:5432' },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    filter.catch(exception, mockHost(req, res));

    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe(
      'An unexpected error occurred. Please try again later.',
    );
  });
});
