import { encryptBuffer, decryptBuffer } from './common/crypto.util';
import { BruteForceGuard } from './auth/brute-force.guard';

describe('prismn Backend Features (BE-135, BE-134, BE-133, BE-132)', () => {
  it('crypto.util encrypts and decrypts buffer', () => {
    const original = Buffer.from('Sensitive Land Document Data');
    const encrypted = encryptBuffer(original);
    expect(encrypted.equals(original)).toBe(false);

    const decrypted = decryptBuffer(encrypted);
    expect(decrypted.toString()).toBe('Sensitive Land Document Data');
  });

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
