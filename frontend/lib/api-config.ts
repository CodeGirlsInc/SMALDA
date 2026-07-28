/**
 * Shared API configuration for the frontend.
 * All API calls should use this base to ensure version consistency.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const API_VERSION = "v1";

export const API_URL = `${API_BASE}/api/${API_VERSION}`;
