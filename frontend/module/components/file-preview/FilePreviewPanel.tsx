"use client";

import { useEffect, useState } from "react";

interface FilePreviewPanelProps {
  documentId: string;
  mimeType: string;
}

const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg"];
const SUPPORTED_TYPES = [...SUPPORTED_IMAGE_TYPES, "application/pdf"];

export default function FilePreviewPanel({
  documentId,
  mimeType,
}: FilePreviewPanelProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSupported = SUPPORTED_TYPES.includes(mimeType);
  const isImage = SUPPORTED_IMAGE_TYPES.includes(mimeType);
  const isPdf = mimeType === "application/pdf";

  const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/module/documents/${documentId}/download`;

  useEffect(() => {
    if (!isSupported) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(downloadUrl, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}`,
          },
        });
        if (!res.ok) throw new Error("Failed to fetch file.");
        const blob = await res.blob();
        setFileUrl(URL.createObjectURL(blob));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load file.");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [documentId, downloadUrl, isSupported]);

  function handleDownload() {
    const a = document.createElement("a");
    a.href = fileUrl ?? downloadUrl;
    a.download = `document-${documentId}`;
    a.click();
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="max-h-[600px] overflow-auto">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : !isSupported ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 text-center p-6">
            <p className="text-sm text-gray-600">
              This file type cannot be previewed.
            </p>
          </div>
        ) : isImage && fileUrl ? (
          <img
            src={fileUrl}
            alt="Document preview"
            className="mx-auto max-w-full object-contain"
          />
        ) : isPdf && fileUrl ? (
          <iframe
            src={fileUrl}
            title="Document preview"
            className="h-[600px] w-full border-0"
          />
        ) : null}
      </div>

      <div className="flex justify-end border-t border-gray-200 p-3">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </button>
      </div>
    </div>
  );
}
