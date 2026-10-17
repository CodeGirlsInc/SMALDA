/**
 * Versioned API URL helpers (#1499).
 *
 * 26 fetch call sites in 9 pages used unversioned `/api/...` URLs, while the
 * backend serves `/api/v1/...`. These helpers build versioned URLs so call
 * sites stop drifting and pick up the version in one place.
 */
export const API_VERSION = "v1";

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Base URL including the API version, e.g. `https://host/api/v1`. */
export function apiBaseUrl(): string {
  return `${RAW_BASE.replace(/\/+$/, "")}/api/${API_VERSION}`;
}

/** Build a versioned API URL from a path such as `/disputes/1`. */
export function apiUrl(path: string): string {
  return `${apiBaseUrl()}/${path.replace(/^\/+/, "")}`;
}
