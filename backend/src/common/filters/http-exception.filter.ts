import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

const GENERIC_MESSAGE =
  'An unexpected error occurred. Please try again later.';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly isProduction = false) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = isHttp ? exception.getResponse() : undefined;

    const { message, error } = this.normalizeResponse(
      errorResponse,
      exception,
      isHttp,
    );

    const requestId =
      (request as any).requestId || request.headers['x-request-id'] || 'req-id';
    const errorCode =
      (errorResponse as any)?.errorCode || error || `ERR_${status}`;

    // `request.path` never contains the query string, so tokens passed as
    // query parameters are not echoed back or written to the log.
    const requestPath =
      request.path || (request.url || '').split('?')[0] || 'unknown';

    const payload: Record<string, unknown> = {
      statusCode: status,
      errorCode,
      message,
      error,
      requestId,
      timestamp: new Date().toISOString(),
      path: requestPath,
    };

    this.logger.error(
      `${status} ${request.method} ${requestPath} -> ${message}`,
      (exception as Error)?.stack,
    );

    if (!this.isProduction && exception instanceof Error) {
      Object.assign(payload, { stack: exception.stack });
    }

    response.status(status).json(payload);
  }

  private normalizeResponse(
    response: string | object | null | undefined,
    exception: unknown,
    isHttp: boolean,
  ) {
    let message = 'Internal server error';
    let error = HttpStatus.INTERNAL_SERVER_ERROR.toString();

    if (typeof response === 'string') {
      message = response;
    } else if (response && typeof response === 'object') {
      const body = response as Record<string, any>;
      if (body.message) {
        message = Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message;
      } else if (exception instanceof Error && exception.message) {
        message = exception.message;
      }
      if (body.error) {
        error = body.error;
      }
    } else if (exception instanceof Error && exception.message) {
      message = exception.message;
    }

    // Messages from thrown HttpExceptions (4xx and 5xx alike) are deliberate
    // API responses - e.g. ValidationPipe feedback - and must be preserved.
    // Only unknown, non-Http errors are collapsed to a generic message.
    if (!isHttp) {
      message = this.sanitizeMessage(message);
    }

    return { message, error };
  }

  private sanitizeMessage(raw: string): string {
    return this.isProduction ? GENERIC_MESSAGE : raw;
  }
}
