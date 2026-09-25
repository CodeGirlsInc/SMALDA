import { invalidateRefresh } from "@/lib/api-client";
import {
  clearAllSessionState,
  consumeSessionResume,
  type SessionStateResult,
} from "@/lib/session-state-preserver";

const ACCESS_TOKEN_KEY = "auth-token";
const REFRESH_TOKEN_KEY = "refresh-token";
const LOGOUT_EVENT_KEY = "logout-event";

/** Shape of `POST /api/v1/auth/login` — mirrors backend/src/auth/auth.service.ts. */
export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
}

function unavailable<T>(): SessionStateResult<T> {
  return { ok: false, error: { code: "unavailable" } };
}

function readLocalStorageItem(key: string): SessionStateResult<string | null> {
  if (typeof window === "undefined") return unavailable<string | null>();
  try {
    return { ok: true, value: window.localStorage.getItem(key) };
  } catch {
    return { ok: false, error: { code: "storage", key } };
  }
}

function restoreLocalStorageItem(
  key: string,
  value: string | null,
): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function invalidSession(): SessionStateResult<void> {
  return { ok: false, error: { code: "unauthenticated" } };
}

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

export function clearSession(): SessionStateResult<void> {
  invalidateRefresh();
  if (typeof window === "undefined") return unavailable<void>();

  let result: SessionStateResult<void> = { ok: true, value: undefined };
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    window.localStorage.setItem(LOGOUT_EVENT_KEY, Date.now().toString());
  } catch {
    result = { ok: false, error: { code: "storage" } };
  }

  const stateResult = clearAllSessionState();
  return stateResult.ok ? result : stateResult;
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
