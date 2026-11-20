/** #1525: build limit/offset/status query params for GET /disputes. */
export function disputesQuery(page: number, limit = 20, status?: string): string {
  const params = new URLSearchParams({ limit: String(limit), offset: String((Math.max(1, page) - 1) * limit) });
  if (status && status !== 'all') params.set('status', status);
  return params.toString();
}

/** #1525: number of pages from the backend's total. */
export const pageCount = (total: number, limit = 20) => Math.max(1, Math.ceil(total / limit));

export type PublicVerifyState = 'verified' | 'revoked' | 'rejected' | 'flagged' | 'unverified';

/** #1526: documentStatus overrides `verified`, so revoked/rejected documents never show as valid. */
export function publicVerifyState(res: { verified: boolean; documentStatus?: string }): PublicVerifyState {
  const status = res.documentStatus?.toUpperCase();
  if (status === 'REVOKED') return 'revoked';
  if (status === 'REJECTED') return 'rejected';
  if (status === 'FLAGGED') return 'flagged';
  return res.verified ? 'verified' : 'unverified';
}
