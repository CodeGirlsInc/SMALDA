import { Injectable, Inject, NestMiddleware } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: Logger,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const userAgent = req.headers['user-agent'] || 'unknown';
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : forwarded?.[0] ?? req.ip;

    res.on('finish', () => {
      const duration = Date.now() - start;
      const payload: Record<string, unknown> = {
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        duration_ms: duration,
        user_agent: userAgent,
        ip,
      };

      if (req.headers.authorization) {
        payload.authorization = '[REDACTED]';
      }

      this.logger.info('http-request', payload);
    });

    next();
  }
}
