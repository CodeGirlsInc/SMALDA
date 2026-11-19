/**
 * Central fetch wrapper with auto refresh-on-401.
 *
 * Exports a `request(path, options)` helper that:
 *   - reads NEXT_PUBLIC_API_URL as the base URL
 *   - authenticates with the httpOnly auth cookies (`credentials: "include"`)
 *   - on 401, attempts a silent refresh via POST /api/v1/auth/refresh
 *   - if refresh also fails, clears the session and redirects to /login
 *   - parses JSON responses
 *   - throws typed ApiError for non-2xx responses
 *
 * Status codes map to i18n keys under `errors.status.*`. Consumers
 * catch ApiError and render <ErrorBanner messageKey={err.messageKey} />.
 * Stack traces and internal identifiers are never surfaced; a validated
 * backend message may be exposed through `ApiError.backendMessage`.
 */

import {
  clearLegacyTokens,
  getTokenExpiryMs,
  writeSessionExpiresAt,
} from "@/lib/session";
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
const LOGOUT_ENDPOINT = `${API_V1_BASE}/auth/logout`;

const LOGOUT_TIMEOUT_MS = 2000;

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

export class RefreshError extends Error {
  readonly status: number | null;
  readonly definitive: boolean;

  constructor(status: number | null, definitive: boolean) {
    super("Session refresh failed");
    this.name = "RefreshError";
    this.status = status;
    this.definitive = definitive;
  }
}

export function isDefinitiveRefreshError(error: unknown): boolean {
  return error instanceof RefreshError && error.definitive;
}

export class RefreshInvalidatedError extends Error {
  constructor() {
    super("Refresh invalidated");
    this.name = "RefreshInvalidatedError";
  }
}

export function isRefreshInvalidatedError(error: unknown): boolean {
  return error instanceof RefreshInvalidatedError;
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

// ── Session clearing ────────────────────────────────────────────────────────

async function logoutServerSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);
  try {
    const response = await fetch(LOGOUT_ENDPOINT, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Clears the local session (and, best-effort, revokes it server-side).
 *
 * `preserveSessionState` skips clearing transactional form state preserved
 * across a redirect (used when a 401 bounces the user to login mid-flow, so
 * they don't lose in-progress work). `notify: false` skips broadcasting the
 * cross-tab logout-event, used when reacting to *another* tab's logout to
 * avoid an infinite storage-event ping-pong.
 */
export function clearSession(
  options: { preserveSessionState?: boolean; notify?: boolean } = {},
): SessionStateResult<void> {
  invalidateRefresh();
  if (typeof window === "undefined") {
    return { ok: false, error: { code: "unavailable" } };
  }

  // Best-effort server-side revocation; do not block local logout on it.
  void logoutServerSession();

  let result: SessionStateResult<void> = { ok: true, value: undefined };
  try {
    clearLegacyTokens();
    writeSessionExpiresAt(null);
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
 * If a session-state resume group is pending, its id is attached as `?resume=`
 * so the login/register flow can restore it after re-authenticating.
 */
function redirectToLogin(): SessionStateResult<void> {
  if (typeof window === "undefined") {
    return { ok: false, error: { code: "unavailable" } };
  }
  const pathname =
    typeof window.location.pathname === "string" ? window.location.pathname : "/";
  const search =
    typeof window.location.search === "string" ? window.location.search : "";
  const currentPath = pathname + search;
  const params = new URLSearchParams();
  params.set("redirect", currentPath);
  const resume = getPendingSessionResumeId();
  if (resume.ok && resume.value) params.set("resume", resume.value);
  window.location.href = `/login?${params.toString()}`;
  return resume.ok ? { ok: true, value: undefined } : resume;
}

// ── Refresh logic ───────────────────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null;
let refreshAbortController: AbortController | null = null;
let authGeneration = 0;

/**
 * Invalidates any in-flight or future refresh tied to the current generation.
 * Called on explicit login/logout so a stale refresh response from before a
 * storeSession()/clearSession() call can never win a race against it.
 */
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
async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  const generation = authGeneration;
  const controller = new AbortController();
  refreshAbortController = controller;

  refreshPromise = (async () => {
    try {
      const res = await fetch(REFRESH_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      if (generation !== authGeneration || controller.signal.aborted) {
        throw new RefreshInvalidatedError();
      }
      if (!res.ok) {
        throw new RefreshError(
          res.status,
          res.status === 400 || res.status === 401 || res.status === 403,
        );
      }

      const data = (await res.json()) as { access_token?: string };
      if (typeof data.access_token !== "string" || !data.access_token) {
        throw new RefreshError(res.status, false);
      }
      if (generation !== authGeneration || controller.signal.aborted) {
        throw new RefreshInvalidatedError();
      }

      const remainingMs = getTokenExpiryMs(data.access_token);
      writeSessionExpiresAt(
        remainingMs === null ? null : Date.now() + remainingMs,
      );
      return data.access_token;
    } catch (error) {
      if (error instanceof RefreshInvalidatedError) throw error;
      if (generation !== authGeneration || controller.signal.aborted) {
        throw new RefreshInvalidatedError();
      }
      if (error instanceof RefreshError) throw error;
      throw new RefreshError(null, false);
    } finally {
      if (refreshPromise) refreshPromise = null;
      if (refreshAbortController === controller) refreshAbortController = null;
    }
  })();

  return refreshPromise;
}

export async function refreshSession(): Promise<string> {
  return refreshAccessToken();
}

// ── Request helper ──────────────────────────────────────────────────────────

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | null | unknown;
  /** Skip the automatic refresh-on-401 (default: false). */
  anonymous?: boolean;
  /** Let a 401 surface to the caller instead of refreshing (default: false). */
  skipAuthRefresh?: boolean;
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

async function executeRequest(
  path: string,
  options: RequestOptions,
): Promise<Response> {
  const { anonymous = false, skipAuthRefresh = false, ...fetchOpts } = options;
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

    return fetch(url, {
      ...fetchOpts,
      credentials: fetchOpts.credentials ?? "include",
      headers,
      body,
    });
  };

  let res: Response;
  try {
    res = await doFetch(null);
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

  if (res.status === 401 && !anonymous && !skipAuthRefresh) {
    try {
      const newToken = await refreshAccessToken();
      res = await doFetch(newToken);
    } catch (error) {
      if (isRefreshInvalidatedError(error)) {
        throw invalidatedRequestError();
      }
      if (isDefinitiveRefreshError(error)) {
        throw authRequiredError();
      }
      if (error instanceof RefreshError) {
        const mapping =
          error.status === null
            ? { kind: "network" as const, messageKey: "errors.status.network" }
            : classifyStatus(error.status);
        throw new ApiError({
          status: error.status,
          ...mapping,
        });
      }
      throw error;
    }

    if (requestGeneration !== authGeneration) {
      throw invalidatedRequestError();
    }
    if (res.status === 401) {
      throw authRequiredError();
    }
  }

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

  return res;
}

export async function request<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const res = await executeRequest(path, options);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function requestBlob(
  path: string,
  options: RequestOptions = {},
): Promise<Blob> {
  const res = await executeRequest(path, options);
  return res.blob();
}

// ── Backward-compatible alias ───────────────────────────────────────────────

/**
 * @deprecated Use `request` instead. Kept for backward compatibility.
 */
export const apiRequest = request;
