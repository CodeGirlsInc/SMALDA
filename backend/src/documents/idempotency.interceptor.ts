import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private cache = new Map<string, { bodyHash: string; response: any }>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    if (!idempotencyKey) {
      return next.handle();
    }

    const currentBodyHash = JSON.stringify(request.body);
    const cached = this.cache.get(idempotencyKey);

    if (cached) {
      if (cached.bodyHash !== currentBodyHash) {
        throw new ConflictException('Idempotency-Key reused with different request payload');
      }
      return of(cached.response);
    }

    return next.handle().pipe(
      tap((res) => {
        this.cache.set(idempotencyKey, { bodyHash: currentBodyHash, response: res });
      }),
    );
  }
}
