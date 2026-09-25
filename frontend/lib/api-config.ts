const DEFAULT_API_ORIGIN = "http://localhost:3001";
const API_VERSION_PREFIX = "/api/v1";

export function normalizeConfiguredBase(value: string): string {
  const base = value.trim().replace(/\/+$/, "");
  if (!base) return `${DEFAULT_API_ORIGIN}${API_VERSION_PREFIX}`;
  if (/\/api\/v1$/i.test(base)) return base;
  if (/\/api$/i.test(base)) return `${base}/v1`;
  return `${base}${API_VERSION_PREFIX}`;
}

export const API_BASE = normalizeConfiguredBase(
  process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_ORIGIN,
);

export function normalizeResourcePath(path: string): string {
  let normalized = path.trim();
  if (!normalized) return "/";
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  normalized = normalized.replace(/^\/api\/v1(?=\/|$)/i, "");
  normalized = normalized.replace(/^\/api(?=\/|$)/i, "");
  return normalized || "/";
}

function toQueryString(
  params?: URLSearchParams | Record<string, string | number | boolean | null | undefined>,
): string {
  if (!params) return "";
  const query = params instanceof URLSearchParams ? params : new URLSearchParams();
  if (!(params instanceof URLSearchParams)) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) query.set(key, String(value));
    }
  }
  const value = query.toString();
  return value ? `?${value}` : "";
}

export function apiUrl(
  path: string,
  params?: URLSearchParams | Record<string, string | number | boolean | null | undefined>,
): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${normalizeResourcePath(path)}${toQueryString(params)}`;
}
