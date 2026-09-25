export const CLIENT_ERROR_ENDPOINT = "/api/client-errors";

const NEXT_DIGEST_PATTERN =
  /^[A-Za-z0-9_-]{1,128}(?:@E[A-Za-z0-9_-]{0,63})?$/;
const EVENT_ID_PATTERN =
  /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export type ClientErrorReport = {
  boundary: "global-error";
  digest: string | null;
  eventId: string | null;
};

export function getSafeErrorDigest(value: unknown): string | null {
  return typeof value === "string" && NEXT_DIGEST_PATTERN.test(value)
    ? value
    : null;
}

export function createOpaqueEventId(): string | null {
  try {
    if (typeof crypto === "undefined") {
      return null;
    }

    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    if (typeof crypto.getRandomValues !== "function") {
      return null;
    }

    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  } catch {
    return null;
  }
}

export function isClientErrorReport(value: unknown): value is ClientErrorReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const report = value as Record<string, unknown>;
  const keys = Object.keys(report);

  return (
    keys.length === 3 &&
    report.boundary === "global-error" &&
    (report.digest === null || getSafeErrorDigest(report.digest) !== null) &&
    (report.eventId === null ||
      (typeof report.eventId === "string" &&
        EVENT_ID_PATTERN.test(report.eventId)))
  );
}
