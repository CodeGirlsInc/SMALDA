"use client";

import { useRef, useState } from "react";

interface DocumentExportButtonProps {
  documentId?: string;
}

type ExportType = "pdf" | "excel";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DocumentExportButton({
  documentId,
}: DocumentExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<ExportType | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const token = () => localStorage.getItem("access_token") ?? "";
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  async function handleExport(type: ExportType) {
    setOpen(false);
    setLoading(type);
    setToastError(null);
    try {
      const url =
        type === "pdf" && documentId
          ? `${apiBase}/api/module/documents/${documentId}/export/pdf`
          : `${apiBase}/api/module/documents/export/excel`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error("Export request failed.");
      const blob = await res.blob();
      const ext = type === "pdf" ? "pdf" : "xlsx";
      const name = documentId
        ? `document-${documentId}.${ext}`
        : `documents.${ext}`;
      downloadBlob(blob, name);
    } catch (err) {
      setToastError(err instanceof Error ? err.message : "Export failed.");
      setTimeout(() => setToastError(null), 4000);
    } finally {
      setLoading(null);
    }
  }

  const showPdf = !!documentId;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Export
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {showPdf && (
            <button
              onClick={() => handleExport("pdf")}
              disabled={loading === "pdf"}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {loading === "pdf" ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              )}
              Export as PDF
            </button>
          )}
          <button
            onClick={() => handleExport("excel")}
            disabled={loading === "excel"}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading === "excel" ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z" />
              </svg>
            )}
            Export as Excel
          </button>
        </div>
      )}

      {toastError && (
        <div className="absolute right-0 top-12 z-30 max-w-xs rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow">
          {toastError}
        </div>
      )}
    </div>
  );
}
