/**
 * Client-side session plumbing shared by the auth pages.
 *
 * FE-43's auth context is not in place yet, so the login page persists the
 * tokens it gets back from `POST /api/auth/login` through here. When the
 * context lands it should take ownership of these functions and the pages
 * should read the session off the context instead of touching storage.
 */

const ACCESS_TOKEN_KEY = "auth-token";
const REFRESH_TOKEN_KEY = "auth-refresh-token";

/** Shape of `POST /api/auth/login` — mirrors backend/src/auth/auth.service.ts. */
export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
}

export function storeSession(tokens: LoginResponse): void {
  if (typeof window === "undefined") return;
  if (tokens.access_token) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  }
  if (tokens.refresh_token) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export const DEFAULT_POST_LOGIN_PATH = "/dashboard";

/**
 * A newline or other control character would let a value smuggle itself past
 * the prefix checks below once it reaches the router, so they are rejected.
 */
function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Resolve the `?redirect=` param that FE-44's middleware appends when it
 * bounces an unauthenticated request, into a path that is safe to navigate to.
 *
 * Anything that could leave the origin falls back to the dashboard, so a
 * crafted `/login?redirect=…` link cannot be used as an open redirect:
 * absolute URLs carry a scheme and therefore never start with `/`, while
 * `//evil.com` and its `/\evil.com` backslash variant are treated as
 * protocol-relative by browsers and so are rejected explicitly.
 */
export function resolvePostLoginPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return DEFAULT_POST_LOGIN_PATH;
  if (raw.startsWith("//") || raw.startsWith("/\\")) {
    return DEFAULT_POST_LOGIN_PATH;
  }
  if (hasControlCharacter(raw)) return DEFAULT_POST_LOGIN_PATH;
  return raw;
}
