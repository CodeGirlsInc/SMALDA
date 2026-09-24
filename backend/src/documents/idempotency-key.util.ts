import { createHash } from 'crypto';

/**
 * Builds an idempotency key scoped to the requesting user, so two
 * different users submitting an identical document no longer collide
 * on the same key.
 */
export function buildIdempotencyKey(userId: string, requestBody: unknown): string {
  const bodyHash = createHash('sha256')
    .update(JSON.stringify(requestBody))
    .digest('hex');
  return `${userId}:${bodyHash}`;
}
