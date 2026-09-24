import { Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * Detects refresh token reuse: once a refresh token has been rotated,
 * any later attempt to use the same (now stale) token revokes the
 * whole token family instead of silently accepting it.
 */
@Injectable()
export class RefreshTokenReuseGuard {
  private readonly usedTokenIds = new Set<string>();
  private readonly revokedFamilies = new Set<string>();

  assertNotReused(tokenId: string, familyId: string): void {
    if (this.revokedFamilies.has(familyId)) {
      throw new UnauthorizedException('Token family revoked');
    }
    if (this.usedTokenIds.has(tokenId)) {
      this.revokedFamilies.add(familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    this.usedTokenIds.add(tokenId);
  }
}
