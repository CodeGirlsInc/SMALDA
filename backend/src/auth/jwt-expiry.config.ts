/**
 * Reads JWT expiry from environment configuration instead of a
 * hardcoded value, so TTL can be tightened per environment.
 */
const DEFAULT_JWT_EXPIRY = '1h';

export function getJwtExpiry(): string {
  return process.env.JWT_EXPIRY ?? DEFAULT_JWT_EXPIRY;
}
