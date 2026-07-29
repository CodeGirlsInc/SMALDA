/**
 * Central fetch wrapper with JWT handling and auto refresh-on-401.
 *
 * Exports a `request(path, options)` helper that:
 *   - reads NEXT_PUBLIC_API_URL as the base URL
 *   - attaches the JWT from localStorage as a Bearer header
 *   - on 401, attempts a silent refresh via POST /auth/refresh
 *   - if refresh also fails, clears the session and redirects to /login
 *   - parses JSON responses
 *   - throws typed ApiError for non-2xx responses
 *
 * Status codes map to i18n keys under `errors.status.*`. Consumers
 * catch ApiError and render <ErrorBanner messageKey={err.messageKey} />.
 * Raw backend error text, stack traces, and internal identifiers are
 * never surfaced.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  // Signal other tabs to also redirect to login
  window.localStorage.setItem("logout-event", Date.now().toString());
}

/**
 * Preserve the current path (including locale) as the post-login destination,
 * then redirect to login. The login page's resolvePostLoginPath reads the
 * `?redirect=` param so the user lands back where they were after signing in.
 */
function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  const currentPath = window.location.pathname + window.location.search;
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
async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        throw new Error("Refresh failed");
      }

      const data = (await res.json()) as { access_token: string };
      setAccessToken(data.access_token);
      return data.access_token;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
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
 *   1. Attempt a silent refresh via POST /auth/refresh
 *   2. If refresh succeeds, retry the original request with the new token
 *   3. If refresh also fails, clear the session and redirect to /login
 */
export async function request<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
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

  // Handle 401 with refresh
  if (res.status === 401 && !anonymous) {
    try {
      const newToken = await refreshAccessToken();
      res = await doFetch(newToken);
    } catch {
      // Refresh failed — clear session and redirect
      clearSession();
      redirectToLogin();
      throw new ApiError({
        status: 401,
        kind: "authRequired",
        messageKey: "errors.status.unauthorized",
      });
    }
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
