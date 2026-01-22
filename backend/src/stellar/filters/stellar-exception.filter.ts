import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class StellarExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(StellarExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || exception.message;
        error = (exceptionResponse as any).error || error;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      
      // Handle specific Stellar errors
      if (exception.message.includes('Transaction failed')) {
        status = HttpStatus.BAD_REQUEST;
        error = 'Transaction Failed';
      } else if (exception.message.includes('Account not found')) {
        status = HttpStatus.NOT_FOUND;
        error = 'Account Not Found';
      } else if (exception.message.includes('Insufficient funds')) {
        status = HttpStatus.PAYMENT_REQUIRED;
        error = 'Insufficient Funds';
      } else if (exception.message.includes('Friendbot request failed')) {
        status = HttpStatus.BAD_GATEWAY;
        error = 'Funding Service Unavailable';
      }
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
    };

    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - Message: ${message}`,
      exception instanceof Error ? exception.stack : exception,
    );

    response.status(status).json(errorResponse);
  }
}
