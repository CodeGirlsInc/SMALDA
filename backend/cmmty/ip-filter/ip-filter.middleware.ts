import { Injectable, NestMiddleware, ForbiddenException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IpFilterService } from './ip-filter.service';

@Injectable()
export class IpFilterMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpFilterMiddleware.name);

  constructor(private readonly ipFilterService: IpFilterService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const clientIp = this.getClientIp(req);
    
    if (!clientIp) {
      this.logger.warn('Unable to determine client IP');
      return next();
    }

    try {
      const isAllowed = await this.ipFilterService.isIpAllowed(clientIp);
      
      if (!isAllowed) {
        this.logger.warn(`Request blocked from IP: ${clientIp}`);
        throw new ForbiddenException('Access denied from your IP address');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  }

  private getClientIp(req: Request): string | null {
    // Check common headers for real IP (behind proxy/load balancer)
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ips = (typeof xForwardedFor === 'string' ? xForwardedFor : xForwardedFor[0])
        .split(',')
        .map((ip) => ip.trim());
      return ips[0] || null;
    }

    const xRealIp = req.headers['x-real-ip'];
    if (xRealIp) {
      return typeof xRealIp === 'string' ? xRealIp : xRealIp[0];
    }

    return req.ip || req.socket?.remoteAddress || null;
  }
}
