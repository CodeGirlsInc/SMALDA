import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AccessLogsService } from '../../access-logs/access-logs.service';
import { AccessAction } from '../../access-logs/entities/access-log.entity';

interface JwtUser {
  id?: string;
  sub?: string;
  role?: string;
}

@Injectable()
export class AccessLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AccessLogMiddleware.name);

  constructor(private readonly accessLogsService: AccessLogsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', async () => {
      const user = req.user as JwtUser | undefined;
      const userId = user?.id || user?.sub || null;
      const documentMatch = req.path.match(/\/documents\/([^/]+)/);
      const documentId = documentMatch?.[1] || null;

      let action = AccessAction.READ;
      if (req.path.includes('/download')) {
        action = AccessAction.DOWNLOAD;
      }
      if (req.path.includes('/export')) {
        action = AccessAction.EXPORT;
      }
      if (res.statusCode === 403 || res.statusCode === 401) {
        action = AccessAction.DENIED;
      }

      const isAdmin = !!user?.role && user.role === 'admin';

      if (isAdmin && action === AccessAction.READ) {
        action = AccessAction.ADMIN_READ;
      }

      const forwarded = req.headers['x-forwarded-for'];
      const ip = typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.ip;

      try {
        await this.accessLogsService.create({
          userId: userId || undefined,
          documentId: documentId || undefined,
          routePath: req.originalUrl || req.url,
          httpMethod: req.method,
          ipAddress: ip || undefined,
          userAgent: req.headers['user-agent'] || undefined,
          action,
          isAdmin,
          statusCode: res.statusCode,
        });
      } catch {
        // Non-blocking — never fail the request
        this.logger.warn('Failed to write access log');
      }
    });

    next();
  }
}
