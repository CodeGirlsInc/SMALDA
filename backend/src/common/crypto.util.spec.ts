import { encryptBuffer, decryptBuffer } from './crypto.util';

describe('crypto.util', () => {
  it('encrypts and decrypts a buffer', () => {
    const original = Buffer.from('Sensitive Land Document Data');
    const encrypted = encryptBuffer(original);
    expect(encrypted.equals(original)).toBe(false);

    const decrypted = decryptBuffer(encrypted);
    expect(decrypted.toString()).toBe('Sensitive Land Document Data');
  });

  it('throws an error when decrypting a tampered buffer', () => {
    const original = Buffer.from('Sensitive Land Document Data');
    const encrypted = encryptBuffer(original);
    encrypted[encrypted.length - 1] ^= 1; // Flip a bit

    expect(() => decryptBuffer(encrypted)).toThrow();
  });

  it('handles an empty buffer', () => {
    const original = Buffer.from('');
    const encrypted = encryptBuffer(original);
    const decrypted = decryptBuffer(encrypted);
    expect(decrypted.toString()).toBe('');
  });

  it('throws an error for oversized input', () => {
    // This test depends on the specific limits of the crypto algorithm
    // and may need adjustment. We'll simulate a very large buffer.
    const largeBuffer = Buffer.alloc(1024 * 1024 * 50); // 50MB
    expect(() => encryptBuffer(largeBuffer)).toThrow();
  });
});
