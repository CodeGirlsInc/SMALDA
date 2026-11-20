import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { getClientIp } from '../common/client-ip';

/**
 * Simple in-memory rate limiter for the login endpoint to make
 * credential-stuffing/brute-force attempts impractical.
 */
@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly attempts = new Map<string, number[]>();
  private readonly windowMs = 60_000;
  private readonly maxAttempts = 5;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key =
      getClientIp(request.headers, request.ip, {
        trustProxy: process.env.TRUST_PROXY === 'true',
      }) ?? 'unknown';
    const now = Date.now();
    const recent = (this.attempts.get(key) ?? []).filter((t) => now - t < this.windowMs);

    if (recent.length >= this.maxAttempts) {
      throw new HttpException('Too many login attempts', HttpStatus.TOO_MANY_REQUESTS);
    }

    recent.push(now);
    this.attempts.set(key, recent);
    return true;
  }
}
