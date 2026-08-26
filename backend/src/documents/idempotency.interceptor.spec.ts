import { ConflictException } from '@nestjs/common';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { Observable, of, firstValueFrom } from 'rxjs';

function createMockContext(headers: Record<string, string>, body: any) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
        body,
      }),
    }),
  } as any;
}

function createMockNext(response: any = { success: true }) {
  return { handle: () => of(response) } as any;
}

describe('IdempotencyInterceptor', () => {
  describe('basic idempotency', () => {
    it('should pass through requests without an idempotency key', async () => {
      const interceptor = new IdempotencyInterceptor();
      const ctx = createMockContext({}, { doc: 'a' });
      const next = createMockNext({ result: 1 });

      const result = await firstValueFrom(interceptor.intercept(ctx, next));
      expect(result).toEqual({ result: 1 });
    });

    it('should cache and replay the response for a duplicate key', async () => {
      const interceptor = new IdempotencyInterceptor();
      const ctx = createMockContext(
        { 'idempotency-key': 'key-1' },
        { doc: 'a' },
      );
      const next = createMockNext({ success: true });

      // First call — processes normally
      const res1 = await firstValueFrom(interceptor.intercept(ctx, next));
      expect(res1).toEqual({ success: true });

      // Second call — replays cached response
      const res2 = await firstValueFrom(interceptor.intercept(ctx, next));
      expect(res2).toEqual({ success: true });
    });
  });

  describe('different request body rejection', () => {
    it('should throw ConflictException when the same key is reused with a different body', async () => {
      const interceptor = new IdempotencyInterceptor();
      const next = createMockNext({ success: true });

      const ctx1 = createMockContext(
        { 'idempotency-key': 'key-diff' },
        { doc: 'a' },
      );
      await firstValueFrom(interceptor.intercept(ctx1, next));

      const ctx2 = createMockContext(
        { 'idempotency-key': 'key-diff' },
        { doc: 'b' }, // different body
      );

      expect(() => interceptor.intercept(ctx2, next)).toThrow(
        ConflictException,
      );
    });

    it('should include a descriptive error message about payload mismatch', async () => {
      const interceptor = new IdempotencyInterceptor();
      const next = createMockNext({ success: true });

      const ctx1 = createMockContext(
        { 'idempotency-key': 'key-msg' },
        { data: 1 },
      );
      await firstValueFrom(interceptor.intercept(ctx1, next));

      const ctx2 = createMockContext(
        { 'idempotency-key': 'key-msg' },
        { data: 2 },
      );

      try {
        interceptor.intercept(ctx2, next);
        fail('Expected ConflictException');
      } catch (e) {
        expect((e as ConflictException).message).toContain('different request payload');
      }
    });
  });

  describe('TTL expiry', () => {
    it('should not replay a cached response after the TTL has expired', async () => {
      const interceptor = new IdempotencyInterceptor(100); // 100ms TTL

      // Mock Date.now so we control time precisely
      const originalNow = Date.now;
      let currentTime = 1000;
      Date.now = jest.fn(() => currentTime);

      try {
        const ctx = createMockContext(
          { 'idempotency-key': 'key-ttl' },
          { doc: 'a' },
        );

        // First call — caches the response at time 1000 (expires at 1100)
        const res1 = await firstValueFrom(
          interceptor.intercept(ctx, createMockNext({ version: 1 })),
        );
        expect(res1).toEqual({ version: 1 });

        // Advance time past the TTL
        currentTime = 2000; // well past 1100

        // Second call — should process again (not replay stale data)
        let callCount = 0;
        const countingNext = {
          handle: () => of({ version: ++callCount }),
        } as any;

        const res2 = await firstValueFrom(
          interceptor.intercept(ctx, countingNext),
        );
        // Should get version 2 (freshly processed), not version 1 (stale)
        expect(res2).toEqual({ version: 2 });
      } finally {
        Date.now = originalNow;
      }
    });

    it('should allow reuse of the same key with the same body within TTL', async () => {
      const interceptor = new IdempotencyInterceptor(60_000);
      const next = createMockNext({ ok: true });

      const ctx = createMockContext(
        { 'idempotency-key': 'key-fresh' },
        { doc: 'a' },
      );

      const res1 = await firstValueFrom(interceptor.intercept(ctx, next));
      const res2 = await firstValueFrom(interceptor.intercept(ctx, next));

      expect(res1).toEqual({ ok: true });
      expect(res2).toEqual({ ok: true });
    });
  });

  describe('concurrent duplicate requests', () => {
    it('should not double-process concurrent requests with the same key', async () => {
      const interceptor = new IdempotencyInterceptor();
      let processCount = 0;

      const slowNext = {
        handle: () =>
          new Observable((subscriber) => {
            setTimeout(() => {
              processCount++;
              subscriber.next({ count: processCount });
              subscriber.complete();
            }, 50);
          }),
      } as any;

      const ctx = createMockContext(
        { 'idempotency-key': 'key-concurrent' },
        { doc: 'a' },
      );

      // Fire two concurrent requests with the same key
      const [res1, res2] = await Promise.all([
        firstValueFrom(interceptor.intercept(ctx, slowNext)),
        firstValueFrom(interceptor.intercept(ctx, slowNext)),
      ]);

      // The handler should only have been called once
      expect(processCount).toBe(1);
      // Both should get the same response
      expect(res1).toEqual({ count: 1 });
      expect(res2).toEqual({ count: 1 });
    });
  });
});
