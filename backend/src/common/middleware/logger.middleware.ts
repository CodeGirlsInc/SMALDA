import { Injectable, Inject, NestMiddleware } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { Request, Response, NextFunction } from 'express';
import { AccessLogsService } from '../../access-logs/access-logs.service';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: Logger,
    private readonly accessLogsService: AccessLogsService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const userAgent = req.headers['user-agent'] || 'unknown';
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : (forwarded?.[0] ?? req.ip);

    res.on('finish', () => {
      const duration = Date.now() - start;
      const routePath = req.originalUrl || req.url;
      const httpMethod = req.method;
      const statusCode = res.statusCode;
      const userId = (req as any).user?.id || null;

      const payload: Record<string, unknown> = {
        method: httpMethod,
        path: routePath,
        status: statusCode,
        duration_ms: duration,
        user_agent: userAgent,
        ip,
        userId,
      };

      if (req.headers.authorization) {
        payload.authorization = '[REDACTED]';
      }

      this.logger.info('http-request', payload);

      // Persist access log via AccessLogsService asynchronously
      this.accessLogsService
        .create({
          userId,
          routePath,
          httpMethod,
          ipAddress: ip || '',
          statusCode,
        })
        .catch((err) => {
          this.logger.error('Failed to save access log record:', err);
        });
    });

    next();
  }
}
