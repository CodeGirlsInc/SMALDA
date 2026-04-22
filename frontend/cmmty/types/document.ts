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
  title: string;
  filePath: string;
  fileHash: string;
  fileSize: number;
  mimeType: string;
  status: DocumentStatus;
  riskScore?: number;
  riskFlags?: string[];
  createdAt: string;
  updatedAt: string;
}
