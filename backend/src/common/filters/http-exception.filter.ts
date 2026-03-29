import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

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
      : { message: (exception as Error)?.message }; // fallback message

    const { message, error } = this.normalizeResponse(errorResponse, exception);

    const payload = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.logger.error(
      `${status} -> ${JSON.stringify(payload)}`,
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
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    return { message, error };
  }
}
