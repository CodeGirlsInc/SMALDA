/**
 * Central fetch wrapper that normalizes errors into a typed ApiError.
 * Status codes map to i18n keys under `errors.status.*`. Consumers
 * catch ApiError and render <ErrorBanner messageKey={err.messageKey} />.
 * Raw backend error text, stack traces, and internal identifiers are
 * never surfaced.
 */

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

  constructor(opts: {
    status: number | null;
    kind: ApiErrorKind;
    messageKey: string;
  }) {
    super(opts.messageKey);
    this.name = "ApiError";
    this.status = opts.status;
    this.kind = opts.kind;
    this.messageKey = opts.messageKey;
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

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | null | unknown;
}

/**
 * Drop-in replacement for `fetch` that:
 *   - serializes plain-object bodies to JSON,
 *   - attaches `Content-Type: application/json` by default,
 *   - converts !res.ok into a typed ApiError,
 *   - silently succeeds on 204 (returns undefined).
 */
export async function apiRequest<T = unknown>(
  input: string,
  opts: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(opts.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let body: BodyInit | null | undefined = undefined;
  if (opts.body !== undefined && opts.body !== null) {
    if (
      typeof opts.body === "string" ||
      opts.body instanceof FormData ||
      opts.body instanceof Blob ||
      opts.body instanceof ArrayBuffer
    ) {
      body = opts.body as BodyInit;
    } else {
      body = JSON.stringify(opts.body);
    }
  }

  let res: Response;
  try {
    res = await fetch(input, {
      ...opts,
      headers,
      body,
    });
  } catch {
    throw new ApiError({
      status: null,
      kind: "network",
      messageKey: "errors.status.network",
    });
  }

  if (!res.ok) {
    const { kind, messageKey } = classifyStatus(res.status);
    throw new ApiError({ status: res.status, kind, messageKey });
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
