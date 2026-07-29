import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

/**
 * Stores the current request correlation ID for the duration of an async
 * execution context. This allows Winston log formats and services to access
 * the correlation ID without threading it through every function call.
 */
export const correlationIdStorage = new AsyncLocalStorage<string>();

/**
 * Generate a new correlation ID. Prefers an inbound X-Request-Id header so
 * trace context can flow in from clients, load balancers, or workers.
 */
export function generateCorrelationId(inbound?: string | string[]): string {
  const header = Array.isArray(inbound) ? inbound[0] : inbound;
  if (header && typeof header === 'string' && header.trim().length > 0) {
    return header.trim();
  }
  return randomUUID();
}

/**
 * Run the callback with the given correlation ID stored in async local
 * storage. Useful for BullMQ workers that need to restore a request's
 * correlation context when processing a job.
 */
export function runWithCorrelationId<T>(
  correlationId: string,
  callback: () => T,
): T {
  return correlationIdStorage.run(correlationId, callback);
}

/**
 * Convenience helper that returns the correlation ID for the current
 * async context, or a fallback value if none is set.
 */
export function getCorrelationId(fallback = 'no-correlation-id'): string {
  return correlationIdStorage.getStore() ?? fallback;
}
