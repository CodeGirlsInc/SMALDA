import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

/** #1571: random single-use token; store only its SHA-256 hash with user id, purpose and expiry. */
export function createSecureToken(purpose: 'reset' | 'verify', ttlMinutes = 30) {
  const token = randomBytes(32).toString('hex');
  return {
    token,
    tokenHash: hashToken(token),
    purpose,
    expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
  };
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** #1572: reset writes passwordHash (cost 12, like everywhere else) and revokes all sessions. */
export async function buildPasswordReset(
  password: string,
  revokeAllSessions: () => Promise<void>,
): Promise<{ passwordHash: string }> {
  const passwordHash = await bcrypt.hash(password, 12);
  await revokeAllSessions();
  return { passwordHash };
}

/** #1570: only development may auto-synchronize; staging/test/production use migrations. */
export const shouldSynchronize = (env = process.env.NODE_ENV) => env === 'development';
