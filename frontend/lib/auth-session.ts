/**
 * Browser-side ownership of the backend's snake-case JWT session response.
 * Tokens are stored separately because the backend rotates only the access
 * token during refresh; malformed or expired tokens are never returned for use.
 */

const ACCESS_TOKEN_KEY = "auth-token";
const REFRESH_TOKEN_KEY = "auth-refresh-token";
const LEGACY_REFRESH_TOKEN_KEY = "refresh-token";
const LOGOUT_EVENT_KEY = "logout-event";

const JWT_ALGORITHM = "HS256";

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
}

export interface JwtClaims {
  sub: string;
  email: string;
  role: string;
  exp: number;
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readToken(key: string): string | null {
  const storage = getLocalStorage();
  if (!storage) return null;

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function removeToken(key: string): void {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch {
    return;
  }
}

function decodeJwtPart(part: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) {
    throw new Error("Invalid JWT encoding");
  }
  if (
    typeof globalThis.atob !== "function" ||
    typeof TextDecoder === "undefined"
  ) {
    throw new Error("JWT decoding is unavailable");
  }

  const padding = "=".repeat((4 - (part.length % 4)) % 4);
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const binary = globalThis.atob(base64 + padding);
  const bytes = Uint8Array.from(binary, (character) =>
    character.charCodeAt(0),
  );

  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  );
}

function isJwtPayload(value: unknown): value is JwtClaims {
  if (typeof value !== "object" || value === null) return false;

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.sub === "string" &&
    payload.sub.length > 0 &&
    typeof payload.email === "string" &&
    payload.email.length > 0 &&
    typeof payload.role === "string" &&
    payload.role.length > 0 &&
    typeof payload.exp === "number" &&
    Number.isSafeInteger(payload.exp) &&
    payload.exp > 0
  );
}

export function getJwtClaims(token: string): JwtClaims | null {
  try {
    const parts = token.split(".");
    if (
      parts.length !== 3 ||
      !/^[A-Za-z0-9_-]+$/.test(parts[2])
    ) {
      return null;
    }

    const header = decodeJwtPart(parts[0]);
    if (
      typeof header !== "object" ||
      header === null ||
      (header as Record<string, unknown>).alg !== JWT_ALGORITHM
    ) {
      return null;
    }

    const payload = decodeJwtPart(parts[1]);
    return isJwtPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

export function getJwtExpiration(token: string): number | null {
  return getJwtClaims(token)?.exp ?? null;
}

function isTokenCurrent(token: string, now: number): boolean {
  const expiration = getJwtExpiration(token);
  return expiration !== null && expiration * 1000 > now;
}

export function getValidAccessToken(): string | null {
  const token = readToken(ACCESS_TOKEN_KEY);
  return token && isTokenCurrent(token, Date.now()) ? token : null;
}

export function getValidRefreshToken(): string | null {
  const canonicalToken = readToken(REFRESH_TOKEN_KEY);
  if (canonicalToken !== null) {
    return isTokenCurrent(canonicalToken, Date.now()) ? canonicalToken : null;
  }

  const legacyToken = readToken(LEGACY_REFRESH_TOKEN_KEY);
  return legacyToken && isTokenCurrent(legacyToken, Date.now())
    ? legacyToken
    : null;
}

export function hasStoredSession(): boolean {
  return (
    readToken(ACCESS_TOKEN_KEY) !== null ||
    readToken(REFRESH_TOKEN_KEY) !== null ||
    readToken(LEGACY_REFRESH_TOKEN_KEY) !== null
  );
}

export function setAccessToken(token: string): boolean {
  if (!isTokenCurrent(token, Date.now())) return false;

  const storage = getLocalStorage();
  if (!storage) return false;

  try {
    storage.setItem(ACCESS_TOKEN_KEY, token);
    return storage.getItem(ACCESS_TOKEN_KEY) === token;
  } catch {
    return false;
  }
}

export function storeSession(tokens: LoginResponse): boolean {
  if (
    typeof window === "undefined" ||
    !tokens.access_token ||
    !isTokenCurrent(tokens.access_token, Date.now()) ||
    (tokens.refresh_token !== undefined &&
      !isTokenCurrent(tokens.refresh_token, Date.now()))
  ) {
    return false;
  }

  const storage = getLocalStorage();
  if (!storage) return false;

  try {
    storage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    if (tokens.refresh_token) {
      storage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
    } else {
      storage.removeItem(REFRESH_TOKEN_KEY);
    }
    storage.removeItem(LEGACY_REFRESH_TOKEN_KEY);

    const storedRefreshToken = tokens.refresh_token
      ? storage.getItem(REFRESH_TOKEN_KEY)
      : null;
    return (
      storage.getItem(ACCESS_TOKEN_KEY) === tokens.access_token &&
      storedRefreshToken === (tokens.refresh_token ?? null) &&
      storage.getItem(LEGACY_REFRESH_TOKEN_KEY) === null
    );
  } catch {
    try {
      storage.removeItem(ACCESS_TOKEN_KEY);
      storage.removeItem(REFRESH_TOKEN_KEY);
      storage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
    } catch {
      return false;
    }
    return false;
  }
}

function clearSessionCookie(): void {
  if (typeof window === "undefined") return;

  try {
    window.document.cookie =
      "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  } catch {
    return;
  }
}

export function clearSession(): void {
  removeToken(ACCESS_TOKEN_KEY);
  removeToken(REFRESH_TOKEN_KEY);
  removeToken(LEGACY_REFRESH_TOKEN_KEY);
  clearSessionCookie();

  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LOGOUT_EVENT_KEY, Date.now().toString());
  } catch {
    return;
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

/**
 * Resolve the `?redirect=` param that FE-44's middleware appends when it
 * bounces an unauthenticated request, into a path that is safe to navigate to.
 *
 * Anything that could leave the origin falls back to the root landing page, so a
 * crafted `/login?redirect=…` link cannot be used as an open redirect:
 * absolute URLs carry a scheme and therefore never start with `/`, while
 * `//evil.com` and its `/\evil.com` backslash variant are treated as
 * protocol-relative by browsers and so are rejected explicitly.
 */
export function resolvePostLoginPath(
  raw: string | null | undefined,
  activeLocale?: string,
): string {
  if (!raw || !raw.startsWith("/")) return DEFAULT_POST_LOGIN_PATH;
  if (raw.startsWith("//") || raw.startsWith("/\\")) {
    return DEFAULT_POST_LOGIN_PATH;
  }
  if (hasControlCharacter(raw)) return DEFAULT_POST_LOGIN_PATH;

  if (activeLocale) {
    const localePrefix = `/${activeLocale}`;
    const pathOnly = raw.split(/[?#]/, 1)[0];
    if (pathOnly === localePrefix) {
      const suffix = raw.slice(localePrefix.length);
      if (suffix.startsWith("?") || suffix.startsWith("#")) {
        return `/${suffix}`;
      }
      return DEFAULT_POST_LOGIN_PATH;
    }
    if (pathOnly.startsWith(`${localePrefix}/`)) {
      return resolvePostLoginPath(raw.slice(localePrefix.length));
    }
  }

  return raw;
}
