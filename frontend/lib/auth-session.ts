/**
 * Client-side session plumbing shared by the auth pages.
 *
 * FE-43's auth context is not in place yet, so the login page persists the
 * tokens it gets back from `POST /api/v1/auth/login` through here. When the
 * context lands it should take ownership of these functions and the pages
 * should read the session off the context instead of touching storage.
 */

import {
  setAccessToken,
  setRefreshToken,
  clearSession,
} from "@/lib/session";

export { clearSession };

/** Shape of `POST /api/v1/auth/login` — mirrors backend/src/auth/auth.service.ts. */
export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
}

export function storeSession(tokens: LoginResponse): void {
  if (typeof window === "undefined") return;
  if (tokens.access_token) {
    setAccessToken(tokens.access_token);
  }
  if (tokens.refresh_token) {
    setRefreshToken(tokens.refresh_token);
  }
}

export const DEFAULT_POST_LOGIN_PATH = "/";

const LOCALE_PREFIX = /^\/(en|fr|es)(?=[/?]|$)/;

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
 * Anything that could leave the origin falls back to the default route, so a
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

  let pathWithoutLocale = raw;
  while (true) {
    const localeMatch = pathWithoutLocale.match(LOCALE_PREFIX);
    if (!localeMatch) break;
    pathWithoutLocale = pathWithoutLocale.slice(localeMatch[0].length) || "/";
  }

  return pathWithoutLocale;
}
