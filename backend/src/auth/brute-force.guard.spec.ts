import { ConfigService } from '@nestjs/config';
import { BruteForceGuard } from './brute-force.guard';

describe('BruteForceGuard', () => {
  it('should be defined', () => {
    const guard = new BruteForceGuard({
      get: () => '30',
    } as unknown as ConfigService);
    expect(guard).toBeDefined();
  });

  it('should lock account after 5 failed attempts', () => {
    const guard = new BruteForceGuard({
      get: () => '15',
    } as unknown as ConfigService);
    const email = 'target@example.com';

    for (let i = 0; i < 5; i++) {
      guard.recordFailedLogin(email);
    }

    const mockCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ body: { email } }),
      }),
    };

    expect(() => guard.canActivate(mockCtx as any)).toThrow(
      'Account locked due to multiple failed login attempts',
    );
  });

  it('should use configurable lock time from env', () => {
    const guard = new BruteForceGuard({
      get: (key: string, defaultVal: string) =>
        key === 'BRUTE_FORCE_LOCK_MINUTES' ? '30' : defaultVal,
    } as unknown as ConfigService);

    const email = 'test@example.com';
    guard.recordFailedLogin(email);
    guard.recordFailedLogin(email);
    guard.recordFailedLogin(email);
    guard.recordFailedLogin(email);
    guard.recordFailedLogin(email);

    const record = (guard as any).failedAttempts.get(email);
    const lockDurationMs = record.lockUntil - Date.now();
    expect(lockDurationMs).toBeGreaterThan(29 * 60 * 1000);
    expect(lockDurationMs).toBeLessThanOrEqual(30 * 60 * 1000);
  });

  it('should reset attempts', () => {
    const guard = new BruteForceGuard({
      get: () => '15',
    } as unknown as ConfigService);
    const email = 'reset@example.com';

    guard.recordFailedLogin(email);
    guard.recordFailedLogin(email);
    guard.resetAttempts(email);

    const mockCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ body: { email } }),
      }),
    };

    expect(() => guard.canActivate(mockCtx as any)).not.toThrow();
  });

  it('should allow access when no email in body', () => {
    const guard = new BruteForceGuard({
      get: () => '15',
    } as unknown as ConfigService);

    const mockCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ body: {} }),
      }),
    };

    expect(guard.canActivate(mockCtx as any)).toBe(true);
  });
});
