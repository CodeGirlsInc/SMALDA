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
  ledgerNumber?: number;
  anchoredTimestamp?: string;
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

export const RISK_FLAG_WEIGHTS: Record<string, number> = {
  duplicate_claim: 40,
  boundary_dispute: 30,
  encoding_issue: 35,
  forged_signature: 50,
  invalid_notary: 42,
  missing_heir: 42,
  expired_permit: 58,
};

export const RISK_FLAG_REMEDIATIONS: Record<string, string> = {
  duplicate_claim:
    "Cross-reference with the land registry to verify ownership records and resolve any conflicting claims.",
  boundary_dispute:
    "Engage a licensed surveyor to conduct a fresh boundary survey and mediate with adjacent landowners.",
  encoding_issue:
    "Re-scan or re-export the document using standard PDF/A format to ensure proper encoding.",
  forged_signature:
    "Request an affidavit from the signatory and consult a forensic document examiner for verification.",
  invalid_notary:
    "Re-notarize the document with a currently licensed and recognized notary public.",
  missing_heir:
    "Conduct a thorough genealogical search and update the declaration with all legal heirs.",
  expired_permit:
    "Apply for permit renewal with the relevant regulatory authority before proceeding.",
};
