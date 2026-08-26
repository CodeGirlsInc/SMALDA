import { BruteForceGuard } from './auth/brute-force.guard';

describe('prismn Backend Features (BE-135, BE-134, BE-133, BE-132)', () => {
  it('BruteForceGuard tracks failed attempts and locks out account', () => {
    const guard = new BruteForceGuard();
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
});
