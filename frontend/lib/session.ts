import { apiUrl } from "@/lib/api-config";
import { clearLastViewedParcel } from "@/lib/map-state";
import {
  clearAllSessionState,
  type SessionStateResult,
} from "@/lib/session-state-preserver";
import { invalidateRefresh } from "@/lib/api-client";

export const ACCESS_TOKEN_KEY = "auth-token";
export const REFRESH_TOKEN_KEY = "auth-refresh-token";
export const LEGACY_REFRESH_TOKEN_KEY = "refresh-token";
export const LOGOUT_EVENT_KEY = "logout-event";

export const AUTH_COOKIE_MODE = true;

const LOGOUT_TIMEOUT_MS = 2000;

let pendingRevocation: Promise<void> | null = null;

export { invalidateRefresh };

export function shouldStoreTokensInLocalStorage(): boolean {
  return !AUTH_COOKIE_MODE;
}

export function clearLegacyLocalStorageTokens(
  storage: Pick<Storage, "removeItem">,
): void {
  for (const key of [
    LEGACY_REFRESH_TOKEN_KEY,
    "access_token",
    "refresh_token",
    "token",
  ]) {
    storage.removeItem(key);
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      window.localStorage.getItem(REFRESH_TOKEN_KEY) ??
      window.localStorage.getItem(LEGACY_REFRESH_TOKEN_KEY)
    );
  } catch {
    return null;
  }
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    return;
  }
}

export function setRefreshToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
    window.localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  } catch {
    return;
  }
}

export function clearRefreshToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  } catch {
    return;
  }
}

export function hasStoredSession(): boolean {
  return Boolean(getAccessToken()?.trim());
}

function clearCookie(name: string): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:";
  const attributes = secure
    ? "Max-Age=0; Path=/; SameSite=None; Secure"
    : "Max-Age=0; Path=/; SameSite=Lax";
  try {
    document.cookie = `${name}=; ${attributes}`;
  } catch {
    return;
  }
}

export function clearLocalSession(
  notify = true,
): SessionStateResult<void> {
  if (typeof window === "undefined") {
    return { ok: false, error: { code: "unavailable" } };
  }

  let result: SessionStateResult<void> = { ok: true, value: undefined };
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    clearRefreshToken();
    if (notify) {
      window.localStorage.setItem(LOGOUT_EVENT_KEY, Date.now().toString());
    }
  } catch {
    result = { ok: false, error: { code: "storage" } };
  }

  clearCookie("smalda_access_token");
  clearCookie(ACCESS_TOKEN_KEY);
  clearCookie("token");
  clearLastViewedParcel();
  return result;
}

async function revokeBackendSession(
  token: string | null,
  refreshToken: string | null,
): Promise<void> {
  if (typeof window === "undefined") return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);
  try {
    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (refreshToken) headers["Content-Type"] = "application/json";

    await fetch(apiUrl("/auth/logout"), {
      method: "POST",
      credentials: "include",
      headers,
      ...(refreshToken ? { body: JSON.stringify({ refreshToken }) } : {}),
      signal: controller.signal,
    });
  } catch {
    return;
  } finally {
    clearTimeout(timeout);
  }
}

export interface ClearSessionOptions {
  preserveSessionState?: boolean;
  notify?: boolean;
  revoke?: boolean;
}

export function clearSession(
  options: ClearSessionOptions = {},
): SessionStateResult<void> {
  invalidateRefresh();
  if (typeof window === "undefined") {
    return { ok: false, error: { code: "unavailable" } };
  }

  if (options.revoke !== false) {
    const revocation = revokeBackendSession(
      getAccessToken(),
      getRefreshToken(),
    );
    pendingRevocation = revocation;
    void revocation;
  }

  const local = clearLocalSession(options.notify !== false);
  if (options.preserveSessionState) return local;
  const stateResult = clearAllSessionState();
  return stateResult.ok ? local : stateResult;
}

export async function logoutSession(): Promise<void> {
  clearSession();
  if (pendingRevocation) await pendingRevocation;
}

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (normalized.length % 4)) % 4;
    const binary = atob(normalized + "=".repeat(padding));
    if (typeof TextDecoder === "undefined") return binary;
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function getTokenExpiryMs(token: string): number | null {
  const payloadPart = token.split(".")[1];
  if (!payloadPart) return null;
  const decoded = decodeBase64Url(payloadPart);
  if (!decoded) return null;

  try {
    const payload: unknown = JSON.parse(decoded);
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("exp" in payload) ||
      typeof payload.exp !== "number" ||
      !Number.isFinite(payload.exp)
    ) {
      return null;
    }
    return payload.exp * 1000 - Date.now();
  } catch {
    return null;
  }
}

export function initCrossTabLogoutSync(): () => void {
  if (typeof window === "undefined") return () => {};

  function handler(event: StorageEvent) {
    if (event.key === LOGOUT_EVENT_KEY && event.newValue) {
      clearSession({ notify: false, revoke: false });
      window.location.href = "/login";
    }
  }

  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
