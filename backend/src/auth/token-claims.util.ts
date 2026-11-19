import { UnauthorizedException } from '@nestjs/common';

export type TokenType = 'access' | 'refresh' | '2fa';

export interface TokenClaims {
  sub: string;
  typ?: TokenType;
  sid?: string;
  purpose?: string;
}

/** #1574: only `typ: 'access'` tokens may authenticate API requests (2FA tokens are rejected). */
export function assertAccessToken(payload: TokenClaims): void {
  if (payload.typ !== 'access' || payload.purpose === '2fa') {
    throw new UnauthorizedException('Invalid token type');
  }
}

/** #1575: reject access tokens whose session (sid) has been revoked. */
export async function assertSessionActive(
  payload: TokenClaims,
  isRevoked: (sid: string) => Promise<boolean>,
): Promise<void> {
  if (!payload.sid || (await isRevoked(payload.sid))) {
    throw new UnauthorizedException('Session has been revoked');
  }
}
