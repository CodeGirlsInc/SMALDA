export interface PublicDocumentView {
  id: string;
  documentHash: string;
  isVerified: boolean;
  timestamp: string;
}

export function toPublicDocumentView(doc: any): PublicDocumentView {
  return {
    id: doc.id,
    documentHash: doc.documentHash,
    isVerified: Boolean(doc.isVerified),
    timestamp: doc.timestamp || new Date().toISOString(),
  };
}
