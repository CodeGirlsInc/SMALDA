import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RateLimitService } from './rate-limit.service';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(private readonly rateLimitService: RateLimitService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const ip = this.getClientIp(req);

    const result = await this.rateLimitService.isRateLimited(ip);

    if (result.limited) {
      const resetTime = result.resetTime!;
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());
      res.setHeader('X-RateLimit-Remaining', '0');

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Add rate limit headers for successful requests
    const remaining = await this.rateLimitService.getRemainingRequests(ip);
    const resetTime = await this.rateLimitService.getResetTime(ip);

    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());
    res.setHeader('X-RateLimit-Limit', this.rateLimitService.getMaxRequests().toString());

    next();
  }

  private getClientIp(req: Request): string {
    // Check for forwarded headers (common in proxy setups)
    const forwarded = req.headers['x-forwarded-for'] as string;
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    // Check for other proxy headers
    const realIp = req.headers['x-real-ip'] as string;
    if (realIp) {
      return realIp;
    }

    // Fall back to connection remote address
    return req.ip || req.connection.remoteAddress || 'unknown';
  }
}