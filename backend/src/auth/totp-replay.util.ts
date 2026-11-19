import { BadRequestException } from '@nestjs/common';

/** #1577: TOTP time step (30s) for a timestamp. */
export const totpStep = (now = Date.now(), period = 30) => Math.floor(now / 1000 / period);

/** #1577: reject a code whose time step is at or below the last accepted one. */
export function isReplayedStep(step: number, lastAcceptedStep?: number | null): boolean {
  return lastAcceptedStep != null && step <= lastAcceptedStep;
}

/** #1577: Redis key for the shared per-user 2FA attempt counter (use with INCR + EXPIRE 60). */
export const twoFactorAttemptKey = (userId: string) => `2fa:attempts:${userId}`;

/** #1579: same complexity rules as registration. */
export const PASSWORD_COMPLEXITY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/** #1579: new password must be complex and differ from the current one. */
export function assertNewPasswordAllowed(current: string, next: string): void {
  if (!PASSWORD_COMPLEXITY.test(next)) {
    throw new BadRequestException('Password must contain upper, lower, digit and special characters');
  }
  if (current === next) throw new BadRequestException('New password must differ from the current one');
}
