import { ConflictException } from '@nestjs/common';

/** #1576: setup must not overwrite an enabled 2FA secret. */
export function assertTwoFactorSetupAllowed(user: { twoFactorEnabled?: boolean }): void {
  if (user.twoFactorEnabled) {
    throw new ConflictException('Two-factor authentication is already enabled; disable it first');
  }
}

/** #1576: keep the new secret pending until confirm() succeeds. */
export const pendingSecretUpdate = (encryptedSecret: string) => ({
  twoFactorPendingSecret: encryptedSecret,
});

/** #1573: the mail calls auth flows must make (MailService shape). */
export interface AuthMailer {
  sendVerificationEmail(to: string, token: string): Promise<unknown>;
  sendPasswordReset?(to: string, token: string): Promise<unknown>;
}

/** #1573: send the right email for register / resend-verification / forgot-password. */
export async function sendAuthMail(mailer: AuthMailer, kind: 'verify' | 'reset', to: string, token: string) {
  if (kind === 'reset' && mailer.sendPasswordReset) return mailer.sendPasswordReset(to, token);
  return mailer.sendVerificationEmail(to, token);
}
