import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY =
  process.env.ENCRYPTION_SECRET || 'smalda-super-secret-key-32chars!';
const IV_LENGTH = 16;

export function encryptBuffer(buffer: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(SECRET_KEY.padEnd(32).slice(0, 32)),
    iv,
  );
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

export function decryptBuffer(encryptedBuffer: Buffer): Buffer {
  const iv = encryptedBuffer.subarray(0, IV_LENGTH);
  const encryptedText = encryptedBuffer.subarray(IV_LENGTH);
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(SECRET_KEY.padEnd(32).slice(0, 32)),
    iv,
  );
  return Buffer.concat([decipher.update(encryptedText), decipher.final()]);
}
