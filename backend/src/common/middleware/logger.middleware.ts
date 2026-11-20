import { Injectable, Inject, NestMiddleware } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { Request, Response, NextFunction } from 'express';
import { AccessLogsService } from '../../access-logs/access-logs.service';

const PROBE_PATH = /(^|\/)(health|metrics)(\/|$)/;

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
    private readonly accessLogsService: AccessLogsService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : 'unknown';

    res.on('finish', () => {
      // `req.path` excludes the query string. Fall back to a manual strip so a
      // token=... query parameter is never persisted, even in non-Express mocks.
      const routePath =
        req.path || (req.originalUrl || req.url || '').split('?')[0] || '/';

      // Health and metrics probes add no audit value and would grow the table
      // indefinitely, so neither log them nor insert an access-log row.
      if (PROBE_PATH.test(routePath)) {
        return;
      }

      const duration = Date.now() - start;
      const httpMethod = req.method;
      const statusCode = res.statusCode;
      const userId = (req as any).user?.id || null;
      const requestId = (req as any).requestId || null;
      // req.ip honours X-Forwarded-For only when Express `trust proxy` is set.
      const ip = req.ip || '';

      const payload: Record<string, unknown> = {
        method: httpMethod,
        path: routePath,
        status: statusCode,
        duration_ms: duration,
        user_agent: userAgent,
        ip,
        userId,
        requestId,
      };

      this.logger.info('http-request', payload);

      // Persist access log via AccessLogsService asynchronously
      this.accessLogsService
        .create({
          userId,
          routePath,
          httpMethod,
          ipAddress: ip,
          userAgent,
          statusCode,
        })
        .catch((err) => {
          this.logger.error('Failed to save access log record:', err);
        });
    });

    next();
  }
}
