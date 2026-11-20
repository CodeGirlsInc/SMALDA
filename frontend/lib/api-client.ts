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

import { API_BASE, getApiOrigin } from "@/lib/api-config";
import {
  ACCESS_TOKEN_KEY,
  LEGACY_REFRESH_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  clearSession,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearRefreshToken,
} from "@/lib/session";
import {
  getPendingSessionResumeId,
  type SessionStateError,
  type SessionStateResult,
} from "@/lib/session-state-preserver";

const API_ORIGIN = getApiOrigin() ?? API_BASE;
export const API_V1_BASE = API_BASE;
const REFRESH_ENDPOINT = `${API_V1_BASE}/auth/refresh`;
const CROSS_TAB_REFRESH_GRACE_MS = 1500;
const CROSS_TAB_REFRESH_POLL_MS = 50;

export { clearSession };

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

// ── Token helpers ───────────────────────────────────────────────────────────

interface RefreshSnapshot {
  accessToken: string | null;
  refreshToken: string | null;
}

function getRefreshSnapshot(): RefreshSnapshot {
  return {
    accessToken: getAccessToken(),
    refreshToken: getRefreshToken(),
  };
}

/**
 * If another tab already rotated the tokens while we were mid-refresh, adopt
 * its result instead of racing it (avoids the server treating our stale
 * refresh token as reused and revoking the whole token family — see #1398).
 */
function getAdoptedRefreshToken(snapshot: RefreshSnapshot): string | null {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  if (
    accessToken &&
    (accessToken !== snapshot.accessToken || refreshToken !== snapshot.refreshToken)
  ) {
    return accessToken;
  }
  return null;
}

function waitForCrossTabRefresh(snapshot: RefreshSnapshot): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  const current = getAdoptedRefreshToken(snapshot);
  if (current) return Promise.resolve(current);

  return new Promise((resolve) => {
    let settled = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let handleStorage: (event: StorageEvent) => void = () => {};

    const finish = () => {
      if (settled) return;
      settled = true;
      if (poll) clearInterval(poll);
      if (timeout) clearTimeout(timeout);
      window.removeEventListener("storage", handleStorage);
      resolve(getAdoptedRefreshToken(snapshot));
    };

    handleStorage = (event: StorageEvent) => {
      if (
        event.key === ACCESS_TOKEN_KEY ||
        event.key === REFRESH_TOKEN_KEY ||
        event.key === LEGACY_REFRESH_TOKEN_KEY
      ) {
        finish();
      }
    };

    window.addEventListener("storage", handleStorage);
    poll = setInterval(finish, CROSS_TAB_REFRESH_POLL_MS);
    timeout = setTimeout(finish, CROSS_TAB_REFRESH_GRACE_MS);
  });
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
async function refreshAccessToken(expectedAccessToken?: string): Promise<string> {
  if (refreshPromise) return refreshPromise;

  const currentAccessToken = getAccessToken();
  if (
    expectedAccessToken &&
    currentAccessToken &&
    currentAccessToken !== expectedAccessToken
  ) {
    return currentAccessToken;
  }

  const generation = authGeneration;
  const controller = new AbortController();
  refreshAbortController = controller;

  refreshPromise = (async () => {
    const snapshot = getRefreshSnapshot();
    try {
      const refreshToken = snapshot.refreshToken;
      if (!refreshToken) {
        throw new RefreshError(null, true);
      }

      const res = await fetch(REFRESH_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
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

      const data = (await res.json()) as {
        access_token?: string;
        refresh_token?: string;
      };
      if (typeof data.access_token !== "string" || !data.access_token) {
        throw new RefreshError(res.status, false);
      }
      if (
        generation !== authGeneration ||
        controller.signal.aborted ||
        getRefreshToken() !== refreshToken
      ) {
        throw new RefreshInvalidatedError();
      }

      setAccessToken(data.access_token);
      // The backend rotates the refresh token on every use (see #1398's
      // reuse-detection); persist whatever it returns or the next refresh
      // will look like reuse of an already-rotated token.
      if (typeof data.refresh_token === "string" && data.refresh_token) {
        setRefreshToken(data.refresh_token);
      } else {
        clearRefreshToken();
      }
      return data.access_token;
    } catch (error) {
      if (error instanceof RefreshInvalidatedError) throw error;
      if (generation !== authGeneration || controller.signal.aborted) {
        throw new RefreshInvalidatedError();
      }
      const adoptedToken = await waitForCrossTabRefresh(snapshot);
      if (adoptedToken) return adoptedToken;
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
  const { anonymous = false, ...fetchOpts } = options;
  const requestGeneration = authGeneration;
  const url = path.startsWith("http") ? path : `${API_ORIGIN}${path}`;

  const doFetch = async (token: string | null): Promise<Response> => {
    const headers = new Headers(fetchOpts.headers);
    const isFormData =
      typeof FormData !== "undefined" && fetchOpts.body instanceof FormData;
    if (!headers.has("Content-Type") && !isFormData) {
      headers.set("Content-Type", "application/json");
    }
    if (!anonymous && token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    let body: BodyInit | null | undefined = undefined;
    if (fetchOpts.body !== undefined && fetchOpts.body !== null) {
      if (isFormData) {
        body = fetchOpts.body as BodyInit;
      } else if (
        typeof fetchOpts.body === "string" ||
        (typeof Blob !== "undefined" && fetchOpts.body instanceof Blob) ||
        (typeof ArrayBuffer !== "undefined" &&
          fetchOpts.body instanceof ArrayBuffer)
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
  let requestAccessToken: string | null = null;
  try {
    requestAccessToken = anonymous ? null : getAccessToken();
    res = await doFetch(requestAccessToken);
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

  if (res.status === 401 && !anonymous) {
    try {
      const newToken = await refreshAccessToken(requestAccessToken ?? undefined);
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

/** Extracts the `filename` from a `Content-Disposition` header, if present. */
export function filenameFromContentDisposition(
  res: Response,
): string | undefined {
  const header = res.headers.get("Content-Disposition");
  if (!header) return undefined;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return undefined;
    }
  }
  const quotedMatch = /filename="([^"]+)"/i.exec(header);
  if (quotedMatch) return quotedMatch[1];
  const plainMatch = /filename=([^;]+)/i.exec(header);
  return plainMatch ? plainMatch[1].trim() : undefined;
}

/**
 * Like `requestBlob`, but also surfaces the server-suggested filename from
 * the `Content-Disposition` header so callers don't have to invent one.
 */
export async function requestBlobWithFilename(
  path: string,
  options: RequestOptions = {},
): Promise<{ blob: Blob; filename?: string }> {
  const res = await executeRequest(path, options);
  const filename = filenameFromContentDisposition(res);
  const blob = await res.blob();
  return { blob, filename };
}

// ── Backward-compatible alias ───────────────────────────────────────────────

/**
 * @deprecated Use `request` instead. Kept for backward compatibility.
 */
export const apiRequest = request;
