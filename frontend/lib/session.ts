import { apiUrl } from "@/lib/api-config";
import { clearLastViewedParcel } from "@/lib/map-state";

export const ACCESS_TOKEN_KEY = "auth-token";
export const REFRESH_TOKEN_KEY = "auth-refresh-token";
export const LEGACY_REFRESH_TOKEN_KEY = "refresh-token";

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
  } catch {
    return;
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
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
    window.localStorage.setItem("logout-event", Date.now().toString());
  } catch (error) {
    void error;
  }

  clearCookie("smalda_access_token");
  clearCookie("auth-token");
  clearCookie("token");
  clearLastViewedParcel();
}

async function revokeBackendSession(
  token: string | null,
  refreshToken: string | null,
): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (refreshToken) headers["Content-Type"] = "application/json";

    await fetch(apiUrl("/auth/logout"), {
      method: "POST",
      credentials: "include",
      headers,
      ...(refreshToken ? { body: JSON.stringify({ refreshToken }) } : {}),
    });
  } catch (error) {
    void error;
  }
}

export async function clearSession(): Promise<void> {
  const token = getAccessToken();
  const refreshToken = getRefreshToken();

  try {
    await revokeBackendSession(token, refreshToken);
  } finally {
    clearLocalSession();
  }
}

export async function logoutSession(): Promise<void> {
  await clearSession();
}
