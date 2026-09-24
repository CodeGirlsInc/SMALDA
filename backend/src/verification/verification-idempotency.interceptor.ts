import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Idempotency guard for the verification endpoint, mirroring the pattern
 * already used by documents/idempotency.interceptor.ts so duplicate
 * verification requests are deduplicated instead of re-processed.
 */
@Injectable()
export class VerificationIdempotencyInterceptor implements NestInterceptor {
  private readonly seenKeys = new Set<string>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['idempotency-key'];

    if (!key) {
      return next.handle();
    }

    if (this.seenKeys.has(key)) {
      throw new ConflictException('Duplicate verification request');
    }

    this.seenKeys.add(key);
    return next.handle();
  }
}
