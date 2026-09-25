/**
 * Client-side session plumbing shared by the auth pages.
 *
 * FE-43's auth context is not in place yet, so the login page persists the
 * tokens it gets back from `POST /api/v1/auth/login` through here. When the
 * context lands it should take ownership of these functions and the pages
 * should read the session off the context instead of touching storage.
 */

import { routing, type Locale } from "@/i18n/routing";

const ACCESS_TOKEN_KEY = "auth-token";
const REFRESH_TOKEN_KEY = "refresh-token";

/** Shape of `POST /api/v1/auth/login` — mirrors backend/src/auth/auth.service.ts. */
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
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export { clearSession } from "./api-client";

export function hasStoredSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage.getItem(ACCESS_TOKEN_KEY)?.trim());
  } catch {
    return false;
  }
}

export const DEFAULT_POST_LOGIN_PATH = "/";

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

function removeLocalePrefix(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0] as Locale | undefined;
  if (!first || !routing.locales.includes(first)) return pathname;
  return segments.length > 1 ? `/${segments.slice(1).join("/")}` : "/";
}

export function resolvePostLoginPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return DEFAULT_POST_LOGIN_PATH;
  if (raw.startsWith("//") || raw.startsWith("/\\")) {
    return DEFAULT_POST_LOGIN_PATH;
  }
  if (hasControlCharacter(raw)) return DEFAULT_POST_LOGIN_PATH;

  try {
    const parsed = new URL(raw, "https://local.invalid");
    if (parsed.origin !== "https://local.invalid") {
      return DEFAULT_POST_LOGIN_PATH;
    }
    return `${removeLocalePrefix(parsed.pathname)}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_POST_LOGIN_PATH;
  }
}
