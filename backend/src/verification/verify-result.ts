import { VerificationStatus } from './entities/verification-record.entity';

export interface PublicVerificationResult {
  verified: boolean;
  status: VerificationStatus;
}

export function toPublicResult(
  status: VerificationStatus,
): PublicVerificationResult {
  return { verified: status === VerificationStatus.CONFIRMED, status };
}

export function canAnchor(status: VerificationStatus | null): boolean {
  return status === null || status === VerificationStatus.PENDING;
}
