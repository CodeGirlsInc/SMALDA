/**
 * Auth guard for the metrics endpoint (#1485).
 *
 * Exposing queue depth and counters to unauthenticated scrapes leaked
 * operational data, and the scrape itself used to mutate the counters. A
 * shared bearer token is now required; a missing token or an unset server
 * configuration denies access with 401.
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

@Injectable()
export class MetricsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.METRICS_TOKEN;
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
    }>();
    const header = request.headers['authorization'] ?? '';
    const [scheme, token, ...rest] = header.split(' ');

    if (
      !expected ||
      scheme !== 'Bearer' ||
      !token ||
      rest.length > 0 ||
      !this.tokensEqual(token, expected)
    ) {
      throw new UnauthorizedException('Invalid or missing metrics token');
    }
    return true;
  }

  private tokensEqual(provided: string, expected: string): boolean {
    const providedHash = createHash('sha256').update(provided).digest();
    const expectedHash = createHash('sha256').update(expected).digest();
    return timingSafeEqual(providedHash, expectedHash);
  }
}
