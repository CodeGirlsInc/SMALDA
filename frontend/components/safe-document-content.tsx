"use client";

import { sanitizeForDisplay, sanitizeUrl } from "@/lib/sanitize";

interface DocumentMetadata {
  filename?: string;
  extractedText?: string;
  description?: string;
  url?: string;
}

interface SafeDocumentContentProps {
  metadata: DocumentMetadata;
  className?: string;
}

export function SafeDocumentContent({ metadata, className }: SafeDocumentContentProps) {
  return (
    <div className={className}>
      {metadata.filename && (
        <p className="font-medium" data-testid="document-filename">
          {sanitizeForDisplay(metadata.filename)}
        </p>
      )}
      {metadata.description && (
        <p className="text-sm text-gray-600" data-testid="document-description">
          {sanitizeForDisplay(metadata.description)}
        </p>
      )}
      {metadata.extractedText && (
        <div
          className="mt-2 rounded border bg-gray-50 p-3 text-sm whitespace-pre-wrap"
          data-testid="document-text"
        >
          {sanitizeForDisplay(metadata.extractedText)}
        </div>
      )}
      {metadata.url && (
        <a
          href={sanitizeUrl(metadata.url)}
          className="mt-2 inline-block text-sm text-blue-600 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="document-link"
        >
          View document
        </a>
      )}
    </div>
  );
}
