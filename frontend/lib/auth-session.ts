/**
 * Client-side session plumbing shared by the auth pages.
 *
 * Tokens are kept in httpOnly cookies set by the backend; only a non-secret
 * expiry hint is stored here so the UI can warn before the session lapses.
 * When the auth context lands it should take ownership of these functions and
 * the pages should read the session off the context instead of touching storage.
 */

import { invalidateRefresh } from "@/lib/api-client";
import {
  clearLegacyTokens,
  getTokenExpiryMs,
  readSessionExpiresAt,
  writeSessionExpiresAt,
} from "@/lib/session";
import {
  clearAllSessionState,
  consumeSessionResume,
  type SessionStateResult,
} from "@/lib/session-state-preserver";
import { routing, type Locale } from "@/i18n/routing";

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

/**
 * Record a non-secret expiry hint for the cookie-backed session. When
 * `resumeId` is present (from the login page's `?resume=` param, set when a
 * 401 bounced the user here mid-flow), the preserved form state for that
 * resume group is restored; otherwise leftover preserved state is cleared.
 * Any legacy tokens in localStorage are removed.
 */
export function storeSession(
  tokens: LoginResponse,
  resumeId?: string,
): SessionStateResult<void> {
  if (typeof window === "undefined") return unavailable<void>();
  if (!tokens?.access_token) return invalidSession();

  invalidateRefresh();
  clearLegacyTokens();

  const stateResult = resumeId
    ? consumeSessionResume(resumeId, tokens.access_token)
    : clearAllSessionState();
  if (!stateResult.ok) return { ok: false, error: stateResult.error };

  const remainingMs = getTokenExpiryMs(tokens.access_token);
  writeSessionExpiresAt(
    remainingMs === null ? null : Date.now() + remainingMs,
  );
  return { ok: true, value: undefined };
}

export { clearSession } from "./api-client";

export function hasStoredSession(): boolean {
  const expiresAt = readSessionExpiresAt();
  return expiresAt !== null && expiresAt > Date.now();
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
