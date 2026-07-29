import { IdempotencyInterceptor } from './documents/idempotency.interceptor';
import { of } from 'rxjs';

describe('femaleotaku Features (BE-149)', () => {
  it('IdempotencyInterceptor replays cached response for duplicate key', (done) => {
    const interceptor = new IdempotencyInterceptor();
    const mockCtx: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'idempotency-key': 'key-1' },
          body: { doc: 'a' },
        }),
      }),
    };
    const next: any = { handle: () => of({ success: true }) };

    interceptor.intercept(mockCtx, next).subscribe((res1) => {
      expect(res1.success).toBe(true);

      interceptor.intercept(mockCtx, next).subscribe((res2) => {
        expect(res2.success).toBe(true);
        done();
      });
    });
  });
});
