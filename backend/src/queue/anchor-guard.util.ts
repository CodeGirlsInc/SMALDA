/**
 * #1583: replace UQ(document_id, status) with a partial unique index so only one
 * CONFIRMED record per document is enforced and FAILED/PENDING retries can insert.
 */
export const CONFIRMED_VERIFICATION_INDEX_SQL = `
  ALTER TABLE verification_records DROP CONSTRAINT IF EXISTS "UQ_VERIFICATION_ACTIVE_DOCUMENT";
  CREATE UNIQUE INDEX IF NOT EXISTS "UQ_VERIFICATION_CONFIRMED_DOCUMENT"
    ON verification_records (document_id) WHERE status = 'CONFIRMED';
`;

/** #1584: skip re-submitting to Stellar when a retry finds the hash already anchored. */
export function shouldSkipAnchor(existing: { status: string; stellarTxHash?: string | null } | null): boolean {
  return !!existing && (existing.status === 'CONFIRMED' || !!existing.stellarTxHash);
}

/** #1584: anchor once, persisting the tx hash before any follow-up step that may throw. */
export async function anchorOnce(
  findExisting: () => Promise<{ status: string; stellarTxHash?: string | null } | null>,
  submit: () => Promise<string>,
  saveTxHash: (txHash: string) => Promise<void>,
): Promise<string | null> {
  const existing = await findExisting();
  if (shouldSkipAnchor(existing)) return existing?.stellarTxHash ?? null;
  const txHash = await submit();
  await saveTxHash(txHash);
  return txHash;
}
