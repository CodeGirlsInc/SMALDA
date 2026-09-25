/**
 * Central fetch wrapper with JWT handling and auto refresh-on-401.
 *
 * Exports a `request(path, options)` helper that:
 *   - reads NEXT_PUBLIC_API_URL as the base URL
 *   - attaches the JWT from localStorage as a Bearer header
 *   - on 401, attempts a silent refresh via POST /api/v1/auth/refresh
 *   - if refresh also fails, clears the session and redirects to /login
 *   - parses JSON responses
 *   - throws typed ApiError for non-2xx responses
 *
 * Status codes map to i18n keys under `errors.status.*`. Consumers
 * catch ApiError and render <ErrorBanner messageKey={err.messageKey} />.
 * Raw backend error text, stack traces, and internal identifiers are
 * never surfaced.
 */

import {
  clearAllSessionState,
  getPendingSessionResumeId,
  type SessionStateError,
  type SessionStateResult,
} from "@/lib/session-state-preserver";

function normalizeApiBase(value: string): string {
  return value
    .trim()
    .replace(/\/+$/, "")
    .replace(/(?:\/api)+(?:\/v1)?$/, "");
}

const API_BASE = normalizeApiBase(
  process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:3001",
);
export const API_V1_BASE = `${API_BASE}/api/v1`;
const REFRESH_ENDPOINT = `${API_V1_BASE}/auth/refresh`;

const ACCESS_TOKEN_KEY = "auth-token";
const REFRESH_TOKEN_KEY = "refresh-token";

// ── ApiError ────────────────────────────────────────────────────────────────

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
  readonly stateError?: SessionStateError;

  constructor(opts: {
    status: number | null;
    kind: ApiErrorKind;
    messageKey: string;
    backendMessage?: string;
    stateError?: SessionStateError;
  }) {
    super(opts.messageKey);
    this.name = "ApiError";
    this.status = opts.status;
    this.kind = opts.kind;
    this.messageKey = opts.messageKey;
    this.backendMessage = opts.backendMessage;
    this.stateError = opts.stateError;
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

// ── Token helpers ───────────────────────────────────────────────────────────

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearSession(
  options: { preserveSessionState?: boolean; notify?: boolean } = {},
): SessionStateResult<void> {
  invalidateRefresh();
  if (typeof window === "undefined") {
    return { ok: false, error: { code: "unavailable" } };
  }

  let result: SessionStateResult<void> = { ok: true, value: undefined };
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    if (options.notify !== false) {
      window.localStorage.setItem("logout-event", Date.now().toString());
    }
  } catch {
    result = { ok: false, error: { code: "storage" } };
  }

  if (options.preserveSessionState) return result;
  const stateResult = clearAllSessionState();
  return stateResult.ok ? result : stateResult;
}

/**
 * Preserve the current path (including locale) as the post-login destination,
 * then redirect to login. The login page's resolvePostLoginPath reads the
 * `?redirect=` param so the user lands back where they were after signing in.
 */
function redirectToLogin(): SessionStateResult<void> {
  if (typeof window === "undefined") {
    return { ok: false, error: { code: "unavailable" } };
  }
  const currentPath = window.location.pathname + window.location.search;
  const params = new URLSearchParams();
  params.set("redirect", currentPath);
  const resume = getPendingSessionResumeId();
  if (resume.ok && resume.value) params.set("resume", resume.value);
  window.location.href = `/login?${params.toString()}`;
  return resume.ok
    ? { ok: true, value: undefined }
    : propagateStateFailure(resume);
}

function propagateStateFailure(
  result: { ok: false; error: SessionStateError },
): SessionStateResult<void> {
  return result;
}

// ── Refresh logic ───────────────────────────────────────────────────────────

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  generation: number;
}

export class RefreshInvalidatedError extends Error {
  constructor() {
    super("Refresh invalidated");
    this.name = "RefreshInvalidatedError";
  }
}

let refreshPromise: Promise<RefreshResult> | null = null;
let refreshAbortController: AbortController | null = null;
let authGeneration = 0;

function isRefreshInvalidatedError(error: unknown): boolean {
  return error instanceof RefreshInvalidatedError;
}

export function invalidateRefresh(): void {
  authGeneration += 1;
  refreshPromise = null;
  const controller = refreshAbortController;
  refreshAbortController = null;
  try {
    controller?.abort();
  } catch {
    return;
  }
}

/**
 * Attempt a silent token refresh. Deduplicates concurrent refresh calls
 * so that multiple 401s in-flight only trigger one refresh request.
 */
function refreshAccessToken(): Promise<RefreshResult> {
  if (refreshPromise) return refreshPromise;

  const generation = authGeneration;
  const controller = new AbortController();
  refreshAbortController = controller;
  const promise = Promise.resolve().then(async () => {
    try {
      if (generation !== authGeneration || controller.signal.aborted) {
        throw new RefreshInvalidatedError();
      }
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const res = await fetch(REFRESH_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error("Refresh failed");
      }

      const data: unknown = await res.json();
      if (
        typeof data !== "object" ||
        data === null ||
        !("access_token" in data) ||
        typeof data.access_token !== "string" ||
        data.access_token.length === 0
      ) {
        throw new Error("Refresh response did not include an access token");
      }
      if (
        generation !== authGeneration ||
        controller.signal.aborted ||
        getRefreshToken() !== refreshToken
      ) {
        throw new RefreshInvalidatedError();
      }
      setAccessToken(data.access_token);
      return {
        accessToken: data.access_token,
        refreshToken,
        generation,
      };
    } catch (error) {
      if (generation !== authGeneration || controller.signal.aborted) {
        throw new RefreshInvalidatedError();
      }
      throw error;
    } finally {
      if (refreshPromise === promise) refreshPromise = null;
      if (refreshAbortController === controller) refreshAbortController = null;
    }
  });

  refreshPromise = promise;
  return promise;
}

export async function refreshSession(): Promise<void> {
  await refreshAccessToken();
}

function isRefreshResultCurrent(result: RefreshResult): boolean {
  return (
    result.generation === authGeneration &&
    getRefreshToken() === result.refreshToken
  );
}

function invalidatedRequestError(): ApiError {
  return new ApiError({
    status: null,
    kind: "network",
    messageKey: "errors.status.network",
  });
}

function authRequiredError(): ApiError {
  const cleared = clearSession({ preserveSessionState: true });
  const redirected = redirectToLogin();
  let stateError: SessionStateError | undefined;
  if (!cleared.ok) stateError = cleared.error;
  else if (!redirected.ok) stateError = redirected.error;
  return new ApiError({
    status: 401,
    kind: "authRequired",
    messageKey: "errors.status.unauthorized",
    stateError,
  });
}

// ── Request helper ──────────────────────────────────────────────────────────

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | null | unknown;
  /** Skip the automatic JWT Bearer header (default: false). */
  anonymous?: boolean;
}

/**
 * Extract a human-readable error message from the backend's error response.
 * Handles common NestJS error shapes:
 *   { message: "..." }
 *   { message: ["...", "..."] }
 *   { error: "..." }
 */
async function extractBackendMessage(
  res: Response,
): Promise<string | undefined> {
  try {
    const body = await res.json();
    if (typeof body === "object" && body !== null) {
      if (typeof body.message === "string") return body.message;
      if (Array.isArray(body.message) && body.message.length > 0)
        return body.message.join(", ");
      if (typeof body.error === "string") return body.error;
    }
  } catch {
    // response body wasn't parseable as JSON — that's fine
  }
  return undefined;
}

/**
 * Core request function. Callers use this instead of raw `fetch`.
 *
 *   const data = await request<{ id: string }>("/documents", { method: "POST", body: { title: "..." } });
 *
 * On a 401 response the function will:
 *   1. Attempt a silent refresh via POST /api/v1/auth/refresh
 *   2. If refresh succeeds, retry the original request with the new token
 *   3. If refresh also fails, clear the session and redirect to /login
 */
export async function request<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { anonymous = false, ...fetchOpts } = options;
  const requestGeneration = authGeneration;

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const doFetch = async (token: string | null): Promise<Response> => {
    const headers = new Headers(fetchOpts.headers);
    if (!headers.has("Content-Type") && !(fetchOpts.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    if (!anonymous && token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    let body: BodyInit | null | undefined = undefined;
    if (fetchOpts.body !== undefined && fetchOpts.body !== null) {
      if (
        typeof fetchOpts.body === "string" ||
        fetchOpts.body instanceof FormData ||
        fetchOpts.body instanceof Blob ||
        fetchOpts.body instanceof ArrayBuffer
      ) {
        body = fetchOpts.body as BodyInit;
      } else {
        body = JSON.stringify(fetchOpts.body);
      }
    }

    return fetch(url, { ...fetchOpts, headers, body });
  };

  // First attempt
  let res: Response;
  try {
    const token = getAccessToken();
    res = await doFetch(token);
  } catch {
    throw new ApiError({
      status: null,
      kind: "network",
      messageKey: "errors.status.network",
    });
  }

  if (requestGeneration !== authGeneration) {
    throw invalidatedRequestError();
  }

  // Handle 401 with refresh
  if (res.status === 401 && !anonymous) {
    let refreshed: RefreshResult;
    try {
      refreshed = await refreshAccessToken();
    } catch (error) {
      if (isRefreshInvalidatedError(error)) {
        throw invalidatedRequestError();
      }
      throw authRequiredError();
    }
    if (
      requestGeneration !== authGeneration ||
      !isRefreshResultCurrent(refreshed)
    ) {
      throw invalidatedRequestError();
    }
    try {
      res = await doFetch(refreshed.accessToken);
    } catch {
      throw new ApiError({
        status: null,
        kind: "network",
        messageKey: "errors.status.network",
      });
    }
  }

  if (requestGeneration !== authGeneration) {
    throw invalidatedRequestError();
  }
  if (res.status === 401 && !anonymous) {
    throw authRequiredError();
  }

  // Handle non-2xx
  if (!res.ok) {
    const { kind, messageKey } = classifyStatus(res.status);
    const backendMessage = await extractBackendMessage(res);
    throw new ApiError({
      status: res.status,
      kind,
      messageKey,
      backendMessage,
    });
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── Backward-compatible alias ───────────────────────────────────────────────

/**
 * @deprecated Use `request` instead. Kept for backward compatibility.
 */
export const apiRequest = request;
