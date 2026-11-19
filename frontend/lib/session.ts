import { apiUrl } from "@/lib/api-config";
import { clearLastViewedParcel } from "@/lib/map-state";

export const ACCESS_TOKEN_KEY = "auth-token";
export const REFRESH_TOKEN_KEY = "auth-refresh-token";
export const LEGACY_REFRESH_TOKEN_KEY = "refresh-token";
export const SESSION_EXPIRES_AT_KEY = "session-expires-at";

export const LEGACY_TOKEN_KEYS = [
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  LEGACY_REFRESH_TOKEN_KEY,
] as const;

export function clearLegacyTokens(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of LEGACY_TOKEN_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    return;
  }
}

export function getAccessToken(): string | null {
  clearLegacyTokens();
  return null;
}

export function getRefreshToken(): string | null {
  clearLegacyTokens();
  return null;
}

export function readSessionExpiresAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_EXPIRES_AT_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeSessionExpiresAt(expiresAt: number | null): void {
  if (typeof window === "undefined") return;
  try {
    if (expiresAt === null || !Number.isFinite(expiresAt)) {
      window.localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
    } else {
      window.localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(expiresAt));
    }
  } catch {
    return;
  }
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

export function clearLocalSession(): void {
  if (typeof window === "undefined") return;

  try {
    clearLegacyTokens();
    writeSessionExpiresAt(null);
    window.localStorage.setItem("logout-event", Date.now().toString());
  } catch (error) {
    void error;
  }

  clearCookie("smalda_access_token");
  clearCookie("auth-token");
  clearCookie("token");
  clearLastViewedParcel();
}

async function revokeBackendSession(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    await fetch(apiUrl("/auth/logout"), {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    void error;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await revokeBackendSession();
  } finally {
    clearLocalSession();
  }
}

export async function logoutSession(): Promise<void> {
  await clearSession();
}
