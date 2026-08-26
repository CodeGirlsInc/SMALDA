import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

const SENSITIVE_ERROR_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /jwt/i,
  /hash/i,
  /bcrypt/i,
  /e\.?r\.?r\.?o\.?r\.?/i,
  /ENOENT/i,
  /EACCES/i,
  /connect.*refused/i,
  /database/i,
  /sql/i,
  /query.*failed/i,
  /constraint/i,
  /duplicate/i,
];

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

    const errorResponse = isHttp
      ? exception.getResponse()
      : { message: 'An unexpected error occurred' };

    const { message, error } = this.normalizeResponse(errorResponse, exception);

    const requestId =
      (request as any).requestId || request.headers['x-request-id'] || 'req-id';
    const errorCode =
      (errorResponse as any)?.errorCode || error || `ERR_${status}`;

    const payload: Record<string, unknown> = {
      statusCode: status,
      errorCode,
      message,
      error,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.logger.error(
      `${status} ${request.method} ${request.url} -> ${message}`,
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
  ) {
    let message = 'Internal server error';
    let error = HttpStatus.INTERNAL_SERVER_ERROR.toString();

    if (typeof response === 'string') {
      message = this.sanitizeMessage(response);
    } else if (response && typeof response === 'object') {
      const body = response as Record<string, any>;
      if (body.message) {
        const raw = Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message;
        message = this.sanitizeMessage(raw);
      } else if (exception instanceof Error && exception.message) {
        message = this.sanitizeMessage(exception.message);
      }

      if (body.error) {
        error = body.error;
      }
    } else if (exception instanceof Error) {
      message = this.sanitizeMessage(exception.message);
    }

    return { message, error };
  }

  private sanitizeMessage(raw: string): string {
    if (!this.isProduction) return raw;

    for (const pattern of SENSITIVE_ERROR_PATTERNS) {
      if (pattern.test(raw)) {
        return 'An unexpected error occurred. Please try again later.';
      }
    }
    return raw;
  }
}
