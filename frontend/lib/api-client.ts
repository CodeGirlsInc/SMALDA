/**
 * Central fetch wrapper for the versioned SMALDA API. Managed authentication is
 * limited to the configured API origin under /api/v1; callers receive the same
 * typed ApiError contract after one bounded reauthentication attempt.
 */

import {
  clearSession,
  getValidAccessToken,
  getValidRefreshToken,
  hasStoredSession,
  setAccessToken,
} from "./auth-session";

export { clearSession } from "./auth-session";

const CONFIGURED_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const API_ORIGIN = new URL(CONFIGURED_API_URL).origin;
const API_ROOT_PATH = "/api/v1";

export const API_V1_ROOT = `${API_ORIGIN}${API_ROOT_PATH}`;

function apiPath(path: string): string {
  const trimmedPath = path.trim();
  if (
    trimmedPath.startsWith("//") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(trimmedPath) ||
    /[\\\u0000-\u001f\u007f]/i.test(path) ||
    /%(?:5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(path)
  ) {
    throw new Error("API path must be a safe relative path");
  }

  let normalized = trimmedPath.replace(/^\/+/, "");
  if (normalized === "api" || normalized === "api/v1") normalized = "";
  else if (normalized.startsWith("api/v1/")) normalized = normalized.slice(7);
  else if (normalized.startsWith("api/")) normalized = normalized.slice(4);

  const url = new URL(normalized, `${API_V1_ROOT}/`);
  if (
    url.origin !== API_ORIGIN ||
    (url.pathname !== API_ROOT_PATH &&
      !url.pathname.startsWith(`${API_ROOT_PATH}/`))
  ) {
    throw new Error("API path escaped the configured API root");
  }

  return url.toString();
}

/** Builds a canonical backend URL while treating NEXT_PUBLIC_API_URL as the origin. */
export function getApiUrl(path: string): string {
  return apiPath(path);
}

export type ApiErrorKind =
  | "authRequired"
  | "forbidden"
  | "validation"
  | "rateLimited"
  | "server"
  | "network"
  | "unknown";

export class ApiError extends Error {
  readonly status: number | null;
  readonly kind: ApiErrorKind;
  readonly messageKey: string;
  readonly backendMessage?: string;

  constructor(opts: {
    status: number | null;
    kind: ApiErrorKind;
    messageKey: string;
    backendMessage?: string;
  }) {
    super(opts.messageKey);
    this.name = "ApiError";
    this.status = opts.status;
    this.kind = opts.kind;
    this.messageKey = opts.messageKey;
    this.backendMessage = opts.backendMessage;
  }
}

export interface ApiErrorMapping {
  kind: ApiErrorKind;
  messageKey: string;
}

export function classifyStatus(status: number): ApiErrorMapping {
  switch (status) {
    case 401:
      return { kind: "authRequired", messageKey: "errors.status.unauthorized" };
    case 403:
      return { kind: "forbidden", messageKey: "errors.status.forbidden" };
    case 422:
      return { kind: "validation", messageKey: "errors.status.validation" };
    case 429:
      return { kind: "rateLimited", messageKey: "errors.status.rateLimited" };
    default:
      if (status >= 500) {
        return { kind: "server", messageKey: "errors.status.server" };
      }
      return { kind: "unknown", messageKey: "errors.status.unknown" };
  }
}

function redirectToLogin(): void {
  if (typeof window === "undefined") return;

  const currentPath = window.location.pathname + window.location.search;
  const params = new URLSearchParams();
  params.set("redirect", currentPath);
  window.location.href = `/login?${params.toString()}`;
}

class RefreshError extends Error {
  readonly kind: "network" | "transient" | "session";
  readonly status: number | null;

  constructor(
    kind: "network" | "transient" | "session",
    status: number | null = null,
  ) {
    super(kind);
    this.name = "RefreshError";
    this.kind = kind;
    this.status = status;
  }
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = getValidRefreshToken();
      if (!refreshToken) throw new RefreshError("session");

      let response: Response;
      try {
        response = await fetch(getApiUrl("auth/refresh"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        throw new RefreshError("network");
      }

      if (!response.ok) {
        if ([400, 401, 403].includes(response.status)) {
          throw new RefreshError("session", response.status);
        }
        throw new RefreshError("transient", response.status);
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new RefreshError("transient", 502);
      }

      const accessToken =
        typeof data === "object" && data !== null
          ? (data as Record<string, unknown>).access_token
          : null;
      if (typeof accessToken !== "string" || !setAccessToken(accessToken)) {
        throw new RefreshError("transient", 502);
      }

      return accessToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function networkError(): ApiError {
  return new ApiError({
    status: null,
    kind: "network",
    messageKey: "errors.status.network",
  });
}

function authRequiredError(): ApiError {
  return new ApiError({
    status: 401,
    kind: "authRequired",
    messageKey: "errors.status.unauthorized",
  });
}

function handleRefreshFailure(error: unknown): never {
  if (error instanceof RefreshError) {
    if (error.kind === "network") throw networkError();
    if (error.kind === "transient") {
      const status = error.status ?? 503;
      const { kind, messageKey } = classifyStatus(status);
      throw new ApiError({ status, kind, messageKey });
    }
  }

  clearSession();
  redirectToLogin();
  throw authRequiredError();
}

/** Returns a current access token, refreshing proactively when a valid refresh token exists. */
export async function ensureValidSession(): Promise<string | null> {
  const accessToken = getValidAccessToken();
  if (accessToken) return accessToken;
  if (!hasStoredSession()) return null;

  try {
    return await refreshAccessToken();
  } catch (error) {
    handleRefreshFailure(error);
  }
}

/**
 * Attempts access-token revocation only; the backend logout contract has no
 * refresh-token or session identifier. Local credentials are always cleared.
 */
export async function logoutSession(): Promise<boolean> {
  let accessToken = getValidAccessToken();
  if (!accessToken && hasStoredSession()) {
    try {
      accessToken = await refreshAccessToken();
    } catch {
      clearSession();
      return false;
    }
  }

  let acknowledged = false;
  if (accessToken) {
    try {
      const response = await fetch(getApiUrl("auth/logout"), {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "omit",
        cache: "no-store",
      });
      acknowledged = response.ok;
    } catch {
      acknowledged = false;
    }
  }

  clearSession();
  return acknowledged;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | null | unknown;
  /** Skip the automatic JWT Bearer header (default: false). */
  anonymous?: boolean;
}

async function extractBackendMessage(
  response: Response,
): Promise<string | undefined> {
  try {
    const body = await response.json();
    if (typeof body === "object" && body !== null) {
      if (typeof body.message === "string") return body.message;
      if (Array.isArray(body.message) && body.message.length > 0) {
        return body.message.join(", ");
      }
      if (typeof body.error === "string") return body.error;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function throwForResponse(response: Response): Promise<void> {
  if (response.ok) return;

  const { kind, messageKey } = classifyStatus(response.status);
  const backendMessage = await extractBackendMessage(response);
  throw new ApiError({
    status: response.status,
    kind,
    messageKey,
    backendMessage,
  });
}

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return getApiUrl(path);
}

function isManagedApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.origin === API_ORIGIN &&
      (parsed.pathname === API_ROOT_PATH ||
        parsed.pathname.startsWith(`${API_ROOT_PATH}/`))
    );
  } catch {
    return false;
  }
}

function isRefreshEndpoint(url: string): boolean {
  try {
    return (
      new URL(url).pathname.replace(/\/+$/, "") ===
      `${API_ROOT_PATH}/auth/refresh`
    );
  } catch {
    return false;
  }
}

function isFormDataBody(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function isUrlSearchParamsBody(body: unknown): body is URLSearchParams {
  return typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams;
}

function isDirectBody(body: unknown): body is BodyInit {
  return (
    typeof body === "string" ||
    (typeof FormData !== "undefined" && body instanceof FormData) ||
    (typeof URLSearchParams !== "undefined" &&
      body instanceof URLSearchParams) ||
    (typeof Blob !== "undefined" && body instanceof Blob) ||
    (typeof ArrayBuffer !== "undefined" &&
      (body instanceof ArrayBuffer || ArrayBuffer.isView(body)))
  );
}

async function sendRequest(
  path: string,
  options: RequestOptions,
): Promise<Response> {
  const { anonymous = false, ...fetchOptions } = options;
  const url = resolveUrl(path);
  const managedApiRequest = isManagedApiUrl(url);
  const callerSuppliedAuthorization = new Headers(
    fetchOptions.headers,
  ).has("Authorization");
  const managesAuthentication =
    managedApiRequest &&
    !isRefreshEndpoint(url) &&
    !anonymous &&
    !callerSuppliedAuthorization;

  const doFetch = async (token: string | null): Promise<Response> => {
    const headers = new Headers(fetchOptions.headers);
    if (
      !headers.has("Content-Type") &&
      !isFormDataBody(fetchOptions.body) &&
      !isUrlSearchParamsBody(fetchOptions.body)
    ) {
      headers.set("Content-Type", "application/json");
    }

    if (!managedApiRequest) {
      headers.delete("Authorization");
    } else if (managesAuthentication && token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    let body: BodyInit | null | undefined;
    if (fetchOptions.body !== undefined && fetchOptions.body !== null) {
      body = isDirectBody(fetchOptions.body)
        ? fetchOptions.body
        : JSON.stringify(fetchOptions.body);
    }

    return fetch(url, { ...fetchOptions, headers, body });
  };

  let token: string | null = null;
  if (managesAuthentication) token = await ensureValidSession();

  let response: Response;
  try {
    response = await doFetch(token);
  } catch {
    throw networkError();
  }

  if (response.status === 401 && managesAuthentication) {
    let replacementToken = getValidAccessToken();
    if (!replacementToken || replacementToken === token) {
      try {
        replacementToken = await refreshAccessToken();
      } catch (error) {
        handleRefreshFailure(error);
      }
    }

    try {
      response = await doFetch(replacementToken);
    } catch {
      throw networkError();
    }
  }

  return response;
}

export async function requestRaw(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const response = await sendRequest(path, options);
  await throwForResponse(response);
  return response;
}

export async function requestBlob(
  path: string,
  options: RequestOptions = {},
): Promise<Blob> {
  const response = await sendRequest(path, options);
  await throwForResponse(response);
  if (response.status === 204) return new Blob();
  return response.blob();
}

export async function request<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await sendRequest(path, options);
  await throwForResponse(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * @deprecated Use `request` instead. Kept for backward compatibility.
 */
export const apiRequest = request;
