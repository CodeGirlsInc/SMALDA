import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

import { MultiLanguageSupportService } from '../../module/i18n/multi-language-support.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(
    private readonly languageService: MultiLanguageSupportService,
    private readonly configService: ConfigService,
  ) {}

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
      : { message: (exception as Error)?.message };

    const languageCode = this.resolveLanguage(request);
    const { message, error } = this.normalizeResponse(
      errorResponse,
      exception,
      status,
      languageCode,
    );

    const payload = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.logger.error(`${status}   -> `, (exception as Error)?.stack);

    if (
      this.configService.get<string>('NODE_ENV') !== 'production' &&
      exception instanceof Error
    ) {
      Object.assign(payload, { stack: exception.stack });
    }

    response.status(status).json(payload);
  }

  private normalizeResponse(
    response: string | object | null | undefined,
    exception: unknown,
    status: HttpStatus,
    languageCode: string,
  ) {
    let message = this.translateStatus(status, languageCode);
    let error = HttpStatus.INTERNAL_SERVER_ERROR.toString();

    if (typeof response === 'string') {
      message = message || response;
    } else if (response && typeof response === 'object') {
      const body = response as Record<string, any>;
      if (!message) {
        if (body.message) {
          message = Array.isArray(body.message)
            ? body.message.join(', ')
            : body.message;
        } else if (exception instanceof Error && exception.message) {
          message = exception.message;
        }
      }

      if (body.error) {
        error = body.error;
      }
    } else if (exception instanceof Error && !message) {
      message = exception.message;
    }

    return { message, error };
  }

  private resolveLanguage(request: Request) {
    const user = (
      request as Request & {
        user?: { preferredLanguage?: string };
      }
    ).user;
    const preferredLanguage = user?.preferredLanguage;

    if (
      preferredLanguage &&
      this.languageService.isSupported(preferredLanguage)
    ) {
      return preferredLanguage;
    }

    return 'en';
  }

  private translateStatus(status: HttpStatus, languageCode: string) {
    if (status === HttpStatus.BAD_REQUEST) {
      return this.languageService.translate(
        'errors.validationFailed',
        languageCode,
      );
    }

    if (status === HttpStatus.FORBIDDEN) {
      return this.languageService.translate('errors.forbidden', languageCode);
    }

    if (status === HttpStatus.NOT_FOUND) {
      return this.languageService.translate('errors.notFound', languageCode);
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      return this.languageService.translate(
        'errors.internalServerError',
        languageCode,
      );
    }

    return '';
  }
}
