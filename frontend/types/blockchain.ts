export type VerificationStatus = "pending" | "verified" | "failed";

export interface VerificationEvent {
  id: string;
  status: VerificationStatus;
  timestamp: string;
  txHash?: string;
}
