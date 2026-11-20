import { NotFoundException } from '@nestjs/common';

/** #1578: hooks the login path must call so lockout guards see failures. */
export interface FailedLoginRecorder {
  recordFailedLogin(email: string): Promise<void> | void;
  resetFailedLogins(email: string): Promise<void> | void;
}

export async function trackLoginOutcome(recorder: FailedLoginRecorder, email: string, ok: boolean) {
  if (ok) await recorder.resetFailedLogins(email);
  else await recorder.recordFailedLogin(email);
}

/** #1578: a refresh token presented after rotation means reuse; revoke the whole family. */
export const isRefreshReuse = (session: { revokedAt?: Date | null } | null) => !!session?.revokedAt;

/** #1580: OAuth providers are optional; enabled only when both id and secret are set. */
export function oauthEnabled(env: NodeJS.ProcessEnv, provider: 'GOOGLE' | 'GITHUB'): boolean {
  return !!env[`${provider}_CLIENT_ID`] && !!env[`${provider}_CLIENT_SECRET`];
}

export function assertOauthEnabled(env: NodeJS.ProcessEnv, provider: 'GOOGLE' | 'GITHUB'): void {
  if (!oauthEnabled(env, provider)) throw new NotFoundException(`${provider} login is not configured`);
}
