/**
 * Auth guard for the metrics endpoint (#1485).
 *
 * `/metrics` was unauthenticated and its handler incremented the document and
 * verification counters on every scrape. This guard requires a shared bearer
 * token before metrics are exposed, so scrapes are authenticated and the scrape
 * itself no longer mutates counters.
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

@Injectable()
export class MetricsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.METRICS_TOKEN;
    if (!expected) {
      return false;
    }
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
    }>();
    const header = request.headers["authorization"] ?? "";
    if (header !== `Bearer ${expected}`) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
