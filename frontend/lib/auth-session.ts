/**
 * Client-side session plumbing shared by the auth pages.
 *
 * FE-43's auth context is not in place yet, so the login page persists the
 * tokens it gets back from `POST /api/v1/auth/login` through here. When the
 * context lands it should take ownership of these functions and the pages
 * should read the session off the context instead of touching storage.
 */

import { invalidateRefresh } from "@/lib/api-client";
import {
  clearAllSessionState,
  consumeSessionResume,
  type SessionStateResult,
} from "@/lib/session-state-preserver";
import { routing, type Locale } from "@/i18n/routing";

const ACCESS_TOKEN_KEY = "auth-token";
const REFRESH_TOKEN_KEY = "refresh-token";

/** Shape of `POST /api/v1/auth/login` — mirrors backend/src/auth/auth.service.ts. */
export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
}

function unavailable<T>(): SessionStateResult<T> {
  return { ok: false, error: { code: "unavailable" } };
}

function invalidSession(): SessionStateResult<void> {
  return { ok: false, error: { code: "unauthenticated" } };
}

function readLocalStorageItem(key: string): SessionStateResult<string | null> {
  if (typeof window === "undefined") return unavailable<string | null>();
  try {
    return { ok: true, value: window.localStorage.getItem(key) };
  } catch {
    return { ok: false, error: { code: "storage", key } };
  }
}

function restoreLocalStorageItem(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    return;
  }
}

/**
 * Persist login tokens. When `resumeId` is present (from the login page's
 * `?resume=` param, set when a 401 bounced the user here mid-flow), the
 * preserved form state for that resume group is restored transactionally;
 * otherwise any leftover preserved state is cleared. On any failure the
 * previous tokens are restored so a half-applied login never sticks.
 */
export function storeSession(
  tokens: LoginResponse,
  resumeId?: string,
): SessionStateResult<void> {
  if (typeof window === "undefined") return unavailable<void>();
  if (!tokens?.access_token) return invalidSession();

  invalidateRefresh();
  const previousAccess = readLocalStorageItem(ACCESS_TOKEN_KEY);
  const previousRefresh = readLocalStorageItem(REFRESH_TOKEN_KEY);
  if (!previousAccess.ok) return previousAccess;
  if (!previousRefresh.ok) return previousRefresh;

  try {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    if (tokens.refresh_token) {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
    } else {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    restoreLocalStorageItem(ACCESS_TOKEN_KEY, previousAccess.value);
    restoreLocalStorageItem(REFRESH_TOKEN_KEY, previousRefresh.value);
    return { ok: false, error: { code: "storage" } };
  }

  const stateResult = resumeId
    ? consumeSessionResume(resumeId, tokens.access_token)
    : clearAllSessionState();
  if (!stateResult.ok) {
    restoreLocalStorageItem(ACCESS_TOKEN_KEY, previousAccess.value);
    restoreLocalStorageItem(REFRESH_TOKEN_KEY, previousRefresh.value);
    return { ok: false, error: stateResult.error };
  }
  return { ok: true, value: undefined };
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

/**
 * Resolve the `?redirect=` param that the protected-route middleware appends
 * when it bounces an unauthenticated request, into a path that is safe to
 * navigate to.
 *
 * Anything that could leave the origin falls back to the default post-login
 * path, so a crafted `/login?redirect=…` link cannot be used as an open
 * redirect: absolute URLs carry a scheme and therefore never start with `/`,
 * while `//evil.com` and its `/\evil.com` backslash variant are treated as
 * protocol-relative by browsers and so are rejected explicitly.
 */
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
