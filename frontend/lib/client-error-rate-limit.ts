import type { ClientErrorReport } from "@/lib/client-error-report";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const DEDUP_WINDOW_MS = 5 * 60_000;
const CLIENT_ERROR_SAMPLE_RATE = 0.1;

export function createClientErrorRateLimiter() {
  let requestTimestamps: number[] = [];
  const seenReports = new Map<string, number>();

  return {
    reset() {
      requestTimestamps = [];
      seenReports.clear();
    },

    isRateLimited(now: number) {
      requestTimestamps = requestTimestamps.filter(
        (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
      );

      if (requestTimestamps.length >= RATE_LIMIT_MAX) {
        return true;
      }

      requestTimestamps.push(now);
      return false;
    },

    shouldDropReport(report: ClientErrorReport, now: number) {
      for (const [fingerprint, timestamp] of seenReports) {
        if (now - timestamp >= DEDUP_WINDOW_MS) {
          seenReports.delete(fingerprint);
        }
      }

      const fingerprint = report.digest
        ? `digest:${report.digest}`
        : `event:${report.eventId ?? "unavailable"}`;
      const previous = seenReports.get(fingerprint);

      if (previous !== undefined && now - previous < DEDUP_WINDOW_MS) {
        return true;
      }

      if (report.digest === null && Math.random() > CLIENT_ERROR_SAMPLE_RATE) {
        return true;
      }

      seenReports.set(fingerprint, now);
      return false;
    },
  };
}

// This state is intentionally per instance and best-effort; serverless
// isolates and replicas need platform-level limits for global enforcement.
export const clientErrorRateLimiter = createClientErrorRateLimiter();
