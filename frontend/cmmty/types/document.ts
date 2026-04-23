export enum DocumentStatus {
  PENDING = "pending",
  ANALYZING = "analyzing",
  VERIFIED = "verified",
  FLAGGED = "flagged",
  REJECTED = "rejected",
}

export interface Document {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  filePath: string;
  fileHash: string;
  fileSize: number;
  mimeType: string;
  status: DocumentStatus;
  riskScore?: number;
  riskFlags?: string[];
  stellarTxHash?: string;
  createdAt: string;
  updatedAt: string;
}

export const RISK_FLAG_DESCRIPTIONS: Record<string, string> = {
  duplicate_claim:
    "This document has been identified as a potential duplicate of another registered claim.",
  boundary_dispute:
    "There is an ongoing boundary dispute associated with this property.",
  encoding_issue:
    "The document contains encoding inconsistencies that require manual review.",
  forged_signature:
    "The signature on this document failed authenticity checks.",
  invalid_notary:
    "The notary associated with this document is not recognized or has been revoked.",
  missing_heir:
    "One or more legal heirs appear to be missing from the inheritance declaration.",
  expired_permit:
    "The permit or license referenced in this document has expired.",
};
