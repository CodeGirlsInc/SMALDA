/**
 * Auth credential storage policy (#1501, #1500).
 *
 * Access/refresh tokens were written to `localStorage` even though the backend
 * already sets httpOnly cookies. Pages that read tokens from `localStorage`
 * also bypassed `lib/api-client`, so they missed 401 handling and refresh. This
 * module makes cookies authoritative and exposes a migration helper to drop
 * legacy localStorage tokens.
 */

/** Cookies are the single source of truth for auth (backend sets httpOnly). */
export const AUTH_COOKIE_MODE = true;

/** Whether client code is allowed to persist tokens itself. */
export function shouldStoreTokensInLocalStorage(): boolean {
  return !AUTH_COOKIE_MODE;
}

/**
 * Remove any legacy tokens persisted in storage. Call once on boot to migrate
 * existing sessions onto cookie auth (#1501).
 */
export function clearLegacyLocalStorageTokens(
  storage: Pick<Storage, "removeItem">,
): void {
  for (const key of ["access_token", "refresh_token", "token"]) {
    storage.removeItem(key);
  }
}
