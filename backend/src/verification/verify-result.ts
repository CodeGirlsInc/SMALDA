/**
 * Verification result semantics (#1481) and anchor idempotency helper (#1480).
 *
 * The public `/verify/:hash` endpoint reported `verified: true` for any stored
 * record, including FAILED ones. These helpers centralise the mapping from a
 * stored verification status to the public response, and guard re-anchoring.
 */

export enum VerificationStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  FAILED = "FAILED",
  UNSURE = "UNSURE",
}

export interface PublicVerificationResult {
  verified: boolean;
  status: VerificationStatus;
}

/** Map a stored verification status to the public result. */
export function toPublicResult(
  status: VerificationStatus,
): PublicVerificationResult {
  return { verified: status === VerificationStatus.VERIFIED, status };
}

/** Whether a document may be anchored, guarding against double-anchor (#1480). */
export function canAnchor(status: VerificationStatus | null): boolean {
  return status === null || status === VerificationStatus.PENDING;
}
