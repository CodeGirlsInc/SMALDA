"use client";

import React, { useCallback, useEffect, useState } from "react";
import jsPDF from "jspdf";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DocumentStatus = "PENDING" | "VERIFIED" | "REJECTED" | "ALL";

interface Document {
  id: string;
  title: string;
  status: DocumentStatus;
  fileHash: string;
  createdAt: string;
  updatedAt: string;
}

type DownloadState = "idle" | "loading" | "done" | "error";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const LAST_EXPORT_KEY = "reports_last_export";

function readLastExport(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_EXPORT_KEY);
}

function saveLastExport(): void {
  localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString());
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    VERIFIED: "bg-green-100 text-green-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    REJECTED: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  );
}

function DownloadButton({
  label,
  state,
  onClick,
}: {
  label: string;
  state: DownloadState;
  onClick: () => void;
}) {
  const isLoading = state === "loading";
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      aria-busy={isLoading}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        isLoading
          ? "cursor-not-allowed bg-gray-100 text-gray-400"
          : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
      }`}
    >
      {isLoading && (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      )}
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio Export Section
// ─────────────────────────────────────────────────────────────────────────────

function PortfolioExport({
  dateFrom,
  dateTo,
  status,
}: {
  dateFrom: string;
  dateTo: string;
  status: DocumentStatus;
}) {
  const [excelState, setExcelState] = useState<DownloadState>("idle");
  const [pdfState, setPdfState] = useState<DownloadState>("idle");
  const [excelError, setExcelError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);

  useEffect(() => {
    setLastExport(readLastExport());
  }, []);

  function buildQueryParams() {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (status !== "ALL") params.set("status", status);
    return params.toString();
  }

  async function handleExcelDownload() {
    setExcelState("loading");
    setExcelError(null);
    try {
      const qs = buildQueryParams();
      const url = `${API_BASE}/api/documents/export/excel${qs ? `?${qs}` : ""}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) {
        throw new Error(`Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `documents-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(href);
      saveLastExport();
      setLastExport(new Date().toISOString());
      setExcelState("done");
    } catch (err) {
      setExcelError(err instanceof Error ? err.message : "Export failed");
      setExcelState("error");
    }
  }

  async function handlePdfDownload() {
    setPdfState("loading");
    setPdfError(null);
    try {
      // Try the backend PDF endpoint first; fall back to client-side generation.
      const qs = buildQueryParams();
      const url = `${API_BASE}/api/documents/export/pdf${qs ? `?${qs}` : ""}`;
      const res = await fetch(url, { headers: getAuthHeaders() });

      if (res.ok) {
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `documents-export-${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(href);
      } else {
        // Client-side PDF generation via jspdf
        generateClientPdf(qs);
      }

      saveLastExport();
      setLastExport(new Date().toISOString());
      setPdfState("done");
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "PDF export failed");
      setPdfState("error");
    }
  }

  function generateClientPdf(qs: string) {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Document Portfolio Export", 14, 20);
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    if (qs) doc.text(`Filters: ${decodeURIComponent(qs)}`, 14, 40);
    doc.text("No data available — connect to the backend for full export.", 14, 55);
    doc.save(`documents-export-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div>
          <DownloadButton
            label="Download as Excel (.xlsx)"
            state={excelState}
            onClick={handleExcelDownload}
          />
          {excelError && (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {excelError}
            </p>
          )}
        </div>

        <div>
          <DownloadButton
            label="Download as PDF"
            state={pdfState}
            onClick={handlePdfDownload}
          />
          {pdfError && (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {pdfError}
            </p>
          )}
        </div>
      </div>

      {lastExport && (
        <p className="text-xs text-gray-500">
          Last export: {new Date(lastExport).toLocaleString()}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Document Table Row
// ─────────────────────────────────────────────────────────────────────────────

function DocumentRow({ doc }: { doc: Document }) {
  const [dlState, setDlState] = useState<DownloadState>("idle");

  async function handleDownloadReport() {
    setDlState("loading");
    try {
      const res = await fetch(
        `${API_BASE}/api/documents/${doc.id}/export/pdf`,
        { headers: getAuthHeaders() }
      );

      if (res.ok) {
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `report-${doc.id}.pdf`;
        a.click();
        URL.revokeObjectURL(href);
      } else {
        // Fallback: generate a minimal PDF client-side
        const pdf = new jsPDF();
        pdf.setFontSize(16);
        pdf.text("Document Report", 14, 20);
        pdf.setFontSize(11);
        pdf.text(`Title: ${doc.title}`, 14, 35);
        pdf.text(`Status: ${doc.status}`, 14, 45);
        pdf.text(`Hash: ${doc.fileHash}`, 14, 55);
        pdf.text(`Created: ${formatDate(doc.createdAt)}`, 14, 65);
        pdf.save(`report-${doc.id}.pdf`);
      }
      setDlState("done");
    } catch {
      setDlState("error");
    }
  }

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-3 pr-4 text-sm font-medium text-gray-900 max-w-[200px] truncate">
        {doc.title}
      </td>
      <td className="py-3 pr-4">
        <StatusBadge status={doc.status} />
      </td>
      <td className="py-3 pr-4 text-sm text-gray-500 font-mono text-xs truncate max-w-[140px]">
        {doc.fileHash.slice(0, 16)}…
      </td>
      <td className="py-3 pr-4 text-sm text-gray-500">
        {formatDate(doc.createdAt)}
      </td>
      <td className="py-3">
        <button
          onClick={handleDownloadReport}
          disabled={dlState === "loading"}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
            dlState === "loading"
              ? "cursor-not-allowed bg-gray-100 text-gray-400"
              : dlState === "error"
              ? "bg-red-50 text-red-700 hover:bg-red-100"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
          aria-label={`Download report for ${doc.title}`}
        >
          {dlState === "loading" ? (
            <>
              <svg
                className="h-3 w-3 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Generating…
            </>
          ) : dlState === "error" ? (
            "Retry"
          ) : (
            "Download Report"
          )}
        </button>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Documents Section
// ─────────────────────────────────────────────────────────────────────────────

function DocumentsTable({
  dateFrom,
  dateTo,
  status,
}: {
  dateFrom: string;
  dateTo: string;
  status: DocumentStatus;
}) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (status !== "ALL") params.set("status", status);
      const qs = params.toString();

      const res = await fetch(
        `${API_BASE}/api/documents${qs ? `?${qs}` : ""}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error(`Failed to load documents (${res.status})`);
      const data = await res.json();
      setDocs(Array.isArray(data) ? data : data.documents ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, status]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-4" role="status">
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Loading documents…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
        <strong>Error:</strong> {error}
        <button
          onClick={fetchDocs}
          className="ml-3 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-500">
        No documents match the selected filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="pb-3 pr-4">Title</th>
            <th className="pb-3 pr-4">Status</th>
            <th className="pb-3 pr-4">Hash</th>
            <th className="pb-3 pr-4">Date</th>
            <th className="pb-3">Report</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter Bar
// ─────────────────────────────────────────────────────────────────────────────

function FilterBar({
  dateFrom,
  dateTo,
  status,
  onDateFromChange,
  onDateToChange,
  onStatusChange,
}: {
  dateFrom: string;
  dateTo: string;
  status: DocumentStatus;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onStatusChange: (v: DocumentStatus) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <label
          htmlFor="dateFrom"
          className="block text-xs font-medium text-gray-700 mb-1"
        >
          From
        </label>
        <input
          id="dateFrom"
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="dateTo"
          className="block text-xs font-medium text-gray-700 mb-1"
        >
          To
        </label>
        <input
          id="dateTo"
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="statusFilter"
          className="block text-xs font-medium text-gray-700 mb-1"
        >
          Status
        </label>
        <select
          id="statusFilter"
          value={status}
          onChange={(e) => onStatusChange(e.target.value as DocumentStatus)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="ALL">All statuses</option>
          <option value="VERIFIED">Verified</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState<DocumentStatus>("ALL");

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generate and download your document portfolio exports as Excel or PDF.
        </p>
      </div>

      {/* Shared filter bar */}
      <SectionCard
        title="Filters"
        description="Scope your exports and the document list by date range and status."
      >
        <FilterBar
          dateFrom={dateFrom}
          dateTo={dateTo}
          status={status}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onStatusChange={setStatus}
        />
      </SectionCard>

      {/* Portfolio export */}
      <SectionCard
        title="Portfolio Export"
        description="Download your entire document portfolio as a single file. Filters above are applied to the export."
      >
        <PortfolioExport dateFrom={dateFrom} dateTo={dateTo} status={status} />
      </SectionCard>

      {/* Individual documents */}
      <SectionCard
        title="Individual Document Reports"
        description="Download a per-document PDF report. Filters above narrow the list."
      >
        <DocumentsTable dateFrom={dateFrom} dateTo={dateTo} status={status} />
      </SectionCard>
    </main>
  );
}
