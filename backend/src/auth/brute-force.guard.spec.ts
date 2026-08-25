import { BruteForceGuard } from './brute-force.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('BruteForceGuard', () => {
  let guard: BruteForceGuard;
  let context: ExecutionContext;

  beforeEach(() => {
    guard = new BruteForceGuard();
    context = {
      switchToHttp: () => ({
        getRequest: () => ({
          body: { email: 'test@example.com' },
        }),
      }),
    } as ExecutionContext;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access if email is not present', () => {
    context = {
      switchToHttp: () => ({
        getRequest: () => ({
          body: {},
        }),
      }),
    } as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if there are no previous failed attempts', () => {
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should lock the account after MAX_ATTEMPTS', () => {
    const email = 'test@example.com';
    for (let i = 0; i < 5; i++) {
      guard.recordFailedLogin(email);
    }
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should deny access if the account is locked', () => {
    const email = 'test@example.com';
    for (let i = 0; i < 5; i++) {
      guard.recordFailedLogin(email);
    }
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should reset attempts after a successful login', () => {
    const email = 'test@example.com';
    guard.recordFailedLogin(email);
    guard.resetAttempts(email);
    expect(guard.canActivate(context)).toBe(true);
  });
});
