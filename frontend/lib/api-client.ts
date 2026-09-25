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

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(
  /\/+$/,
  "",
);

const ACCESS_TOKEN_KEY = "auth-token";
const REFRESH_TOKEN_KEY = "refresh-token";
const LOGOUT_TIMEOUT_MS = 2000;
const CROSS_TAB_REFRESH_GRACE_MS = 1500;
const CROSS_TAB_REFRESH_POLL_MS = 50;

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
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

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
      if (event.key === ACCESS_TOKEN_KEY || event.key === REFRESH_TOKEN_KEY) {
        finish();
      }
    };

    window.addEventListener("storage", handleStorage);
    poll = setInterval(finish, CROSS_TAB_REFRESH_POLL_MS);
    timeout = setTimeout(finish, CROSS_TAB_REFRESH_GRACE_MS);
  });
}

async function logoutServerSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function clearSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const logoutRequest = logoutServerSession();
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  // Signal other tabs to also redirect to login
  window.localStorage.setItem("logout-event", Date.now().toString());
  return logoutRequest;
}

/**
 * Preserve the current path (including locale) as the post-login destination,
 * then redirect to login. The login page's resolvePostLoginPath reads the
 * `?redirect=` param so the user lands back where they were after signing in.
 */
function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  const pathname =
    typeof window.location.pathname === "string" ? window.location.pathname : "/";
  const search =
    typeof window.location.search === "string" ? window.location.search : "";
  const currentPath = pathname + search;
  const params = new URLSearchParams();
  params.set("redirect", currentPath);
  window.location.href = `/login?${params.toString()}`;
}

// ── Refresh logic ───────────────────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null;

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

  refreshPromise = (async () => {
    const snapshot = getRefreshSnapshot();
    try {
      const refreshToken = snapshot.refreshToken;
      const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: refreshToken
          ? { "Content-Type": "application/json" }
          : undefined,
        body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
      });

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
      setAccessToken(data.access_token);
      if (
        typeof data.refresh_token === "string" &&
        data.refresh_token &&
        typeof window !== "undefined"
      ) {
        window.localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      } else if (typeof window !== "undefined") {
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
      return data.access_token;
    } catch (error) {
      const adoptedToken = await waitForCrossTabRefresh(snapshot);
      if (adoptedToken) return adoptedToken;
      if (error instanceof RefreshError) throw error;
      throw new RefreshError(null, false);
    } finally {
      refreshPromise = null;
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

async function executeRequest(
  path: string,
  options: RequestOptions,
): Promise<Response> {
  const { anonymous = false, ...fetchOpts } = options;
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

  if (res.status === 401 && !anonymous) {
    try {
      const newToken = await refreshAccessToken(requestAccessToken ?? undefined);
      res = await doFetch(newToken);
    } catch (error) {
      if (isDefinitiveRefreshError(error)) {
        await clearSession();
        redirectToLogin();
        throw new ApiError({
          status: 401,
          kind: "authRequired",
          messageKey: "errors.status.unauthorized",
        });
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
