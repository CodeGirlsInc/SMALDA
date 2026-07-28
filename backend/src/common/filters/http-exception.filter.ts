import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { QueryFailedError } from 'typeorm';
import { ErrorCodes } from '../errors/error-codes';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly isProduction = false) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = this.resolveStatus(exception);
    const { message, errorCode, fieldErrors } = this.resolveError(exception);

    const payload: Record<string, unknown> = {
      statusCode: status,
      errorCode,
      message,
      requestId: request['requestId'] || null,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (fieldErrors) {
      payload.fieldErrors = fieldErrors;
    }

    this.logger.error(
      `${status} [${errorCode}] ${request.url}`,
      (exception as Error)?.stack,
    );

    if (!this.isProduction && exception instanceof Error) {
      payload.stack = exception.stack;
    }

    response.status(status).json(payload);
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    if (exception instanceof QueryFailedError) {
      const msg = exception.message || '';
      if (msg.includes('unique constraint') || msg.includes('duplicate key')) {
        return HttpStatus.CONFLICT;
      }
      if (msg.includes('foreign key') || msg.includes('violates foreign key')) {
        return HttpStatus.BAD_REQUEST;
      }
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveError(exception: unknown): {
    message: string;
    errorCode: string;
    fieldErrors?: Record<string, string[]>;
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const status = exception.getStatus();

      if (typeof response === 'string') {
        return {
          message: response,
          errorCode: this.statusToCode(status),
        };
      }

      const body = response as Record<string, any>;

      if (Array.isArray(body.message)) {
        return {
          message: body.message.join(', '),
          errorCode: ErrorCodes.VALIDATION_ERROR,
          fieldErrors: body.fieldErrors,
        };
      }

      return {
        message: body.message || body.error || exception.message,
        errorCode: body.errorCode || this.statusToCode(status),
      };
    }

    if (exception instanceof QueryFailedError) {
      const msg = exception.message || '';
      if (msg.includes('unique constraint') || msg.includes('duplicate key')) {
        return { message: 'Resource already exists', errorCode: ErrorCodes.UNIQUE_VIOLATION };
      }
      if (msg.includes('foreign key') || msg.includes('violates foreign key')) {
        return { message: 'Referenced resource not found', errorCode: ErrorCodes.FK_VIOLATION };
      }
      return { message: 'Database error', errorCode: ErrorCodes.INTEGRITY_VIOLATION };
    }

    return {
      message: (exception as Error)?.message || 'Internal server error',
      errorCode: ErrorCodes.INTERNAL_ERROR,
    };
  }

  private statusToCode(status: number): string {
    switch (status) {
      case 400: return ErrorCodes.BAD_REQUEST;
      case 401: return ErrorCodes.UNAUTHORIZED;
      case 403: return ErrorCodes.FORBIDDEN;
      case 404: return ErrorCodes.NOT_FOUND;
      case 409: return ErrorCodes.CONFLICT;
      case 429: return ErrorCodes.RATE_LIMITED;
      case 413: return ErrorCodes.PAYLOAD_TOO_LARGE;
      default: return ErrorCodes.INTERNAL_ERROR;
    }
  }
}
