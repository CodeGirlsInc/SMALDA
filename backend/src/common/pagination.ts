/**
 * Bounded pagination parsing (#1491).
 *
 * `GET /disputes` parsed `limit`/`offset` with `parseInt` and no bounds, so
 * `NaN`, negative and huge values reached the database. This helper clamps both
 * values to a safe range.
 */
export interface Pagination {
  limit: number;
  offset: number;
}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function parsePagination(
  rawLimit: unknown,
  rawOffset: unknown,
): Pagination {
  return {
    limit: toBoundedInt(rawLimit, DEFAULT_LIMIT, 1, MAX_LIMIT),
    offset: toBoundedInt(rawOffset, 0, 0, Number.MAX_SAFE_INTEGER),
  };
}

function toBoundedInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed =
    typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}
