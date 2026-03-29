import { Injectable, Inject, NestMiddleware } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: Logger,
  ) {}

  use(req: Request & { correlationId?: string }, res: Response, next: NextFunction) {
    const correlationId = uuidv4();
    req.correlationId = correlationId;

    const start = Date.now();
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : forwarded?.[0] ?? req.ip;

    this.logger.info('http-request-incoming', {
      correlationId,
      method: req.method,
      path: req.originalUrl || req.url,
      ip,
    });

    res.on('finish', () => {
      this.logger.info('http-request-finished', {
        correlationId,
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        duration_ms: Date.now() - start,
        authorization: req.headers.authorization ? '[REDACTED]' : undefined,
        cookie: req.headers.cookie ? '[REDACTED]' : undefined,
      });
    });

    next();
  }
}
