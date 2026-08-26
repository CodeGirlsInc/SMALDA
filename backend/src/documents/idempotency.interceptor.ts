import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
} from '@nestjs/common';
import { Observable, of, ReplaySubject } from 'rxjs';

/** Default TTL for idempotency keys in milliseconds (24 hours). */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private cache = new Map<
    string,
    { bodyHash: string; response: any; expiresAt: number }
  >();
  private inflight = new Map<string, Observable<any>>();

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    if (!idempotencyKey) {
      return next.handle();
    }

    const now = Date.now();
    const currentBodyHash = JSON.stringify(request.body);
    const cached = this.cache.get(idempotencyKey);

    // Expire stale entries
    if (cached && cached.expiresAt <= now) {
      this.cache.delete(idempotencyKey);
    }

    const freshCache = this.cache.get(idempotencyKey);

    if (freshCache) {
      if (freshCache.bodyHash !== currentBodyHash) {
        throw new ConflictException(
          'Idempotency-Key reused with different request payload',
        );
      }
      return of(freshCache.response);
    }

    // Handle concurrent duplicate requests: if a request with the same key
    // is already in-flight, return the same shared observable so callers
    // receive the identical result without double-processing.
    const inflightKey = idempotencyKey;
    if (this.inflight.has(inflightKey)) {
      return this.inflight.get(inflightKey)!;
    }

    // Process the request and share the result with concurrent callers
    // via a ReplaySubject.
    const subject = new ReplaySubject<any>(1);
    this.inflight.set(inflightKey, subject);

    next.handle().subscribe({
      next: (res) => {
        this.cache.set(idempotencyKey, {
          bodyHash: currentBodyHash,
          response: res,
          expiresAt: now + this.ttlMs,
        });
        this.inflight.delete(inflightKey);
        subject.next(res);
        subject.complete();
      },
      error: (err) => {
        this.inflight.delete(inflightKey);
        subject.error(err);
      },
    });

    return subject;
  }
}
