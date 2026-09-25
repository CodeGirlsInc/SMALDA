/**
 * Maps untrusted API document records onto the fields intentionally exposed
 * to the UI. This module has no DOM or sanitizer dependency.
 */

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

function toVerified(value: RawDocument["isVerified"]): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value === "1";
  }
  return false;
}

export function toPublicDocumentView(doc: RawDocument): PublicDocumentView {
  return {
    id: doc.id,
    documentHash: doc.documentHash,
    isVerified: toVerified(doc.isVerified),
    timestamp: doc.timestamp || new Date().toISOString(),
  };
}
