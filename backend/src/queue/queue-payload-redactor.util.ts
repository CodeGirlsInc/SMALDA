/**
 * Redacts sensitive document content/metadata from queue observability
 * payloads before they're exposed via the observability endpoint.
 */
const SENSITIVE_FIELDS = ['content', 'fileBuffer', 'metadata'];

export function redactJobPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...payload };
  for (const field of SENSITIVE_FIELDS) {
    if (field in redacted) {
      redacted[field] = '[REDACTED]';
    }
  }
  return redacted;
}
