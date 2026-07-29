export interface PublicDocumentView {
  id: string;
  documentHash: string;
  isVerified: boolean;
  timestamp: string;
}

interface RawDocument {
  id: string;
  documentHash: string;
  isVerified: boolean | string | number;
  timestamp?: string;
}

export function toPublicDocumentView(doc: RawDocument): PublicDocumentView {
  return {
    id: doc.id,
    documentHash: doc.documentHash,
    isVerified: Boolean(doc.isVerified),
    timestamp: doc.timestamp || new Date().toISOString(),
  };
}
