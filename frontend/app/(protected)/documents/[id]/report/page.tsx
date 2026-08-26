"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { jsPDF } from "jspdf";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentReport {
  id: string;
  title: string;
  status: string;
  fileHash?: string;
  riskScore?: number | null;
  riskFlags?: string[] | null;
  stellarTxHash?: string;
  anchoredAt?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Analysis is only considered complete once a risk score exists. */
function hasCompletedAnalysis(doc: DocumentReport): boolean {
  return doc.riskScore != null;
}

const MOCK_DOCUMENT: DocumentReport = {
  id: "doc-123",
  title: "Sample Land Title",
  status: "VERIFIED",
  fileHash: "a".repeat(64),
  riskScore: 62,
  riskFlags: ["Ownership conflict", "Duplicate title"],
  stellarTxHash: "txhash-1234567890abcdef",
  anchoredAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DocumentReportPage() {
  const params = useParams<{ id: string }>();
  const docId = params.id;

  const [doc, setDoc] = useState<DocumentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId) return;
    fetch(`${API_BASE}/api/documents/${docId}`, {
      headers: getAuthHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load document (${res.status})`);
        return res.json() as Promise<DocumentReport>;
      })
      .then(setDoc)
      .catch((err) => {
        // Backend may be unavailable — fall back to sample data.
        setDoc(MOCK_DOCUMENT);
        setError(
          err instanceof Error
            ? `${err.message} — showing sample data`
            : "Showing sample data",
        );
      })
      .finally(() => setLoading(false));
  }, [docId]);

  function handleDownloadPdf() {
    if (!doc || !hasCompletedAnalysis(doc)) return;
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text("Document Risk Report", 14, 20);
    pdf.setFontSize(11);
    pdf.text(`Document: ${doc.title}`, 14, 32);
    pdf.text(`Status: ${doc.status}`, 14, 38);
    pdf.text(`Risk score: ${doc.riskScore}/100`, 14, 44);
    if (doc.stellarTxHash) {
      pdf.text(`Stellar tx hash: ${doc.stellarTxHash}`, 14, 50);
    }
    if (doc.anchoredAt) {
      pdf.text(`Anchored at: ${new Date(doc.anchoredAt).toLocaleString()}`, 14, 56);
    }
    if (doc.riskFlags && doc.riskFlags.length > 0) {
      pdf.text("Risk flags:", 14, 66);
      doc.riskFlags.forEach((flag, i) => {
        pdf.text(`- ${flag}`, 16, 72 + i * 6);
      });
    }
    pdf.save(`document-report-${doc.id}.pdf`);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8" aria-busy="true">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-6 h-64 animate-pulse rounded-xl bg-gray-200" />
      </main>
    );
  }

  if (!doc) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-sm text-red-600">
          {error ?? "Document not found."}
        </p>
        <Link href="/documents" className="mt-3 block text-sm text-blue-600 underline">
          Back to documents
        </Link>
      </main>
    );
  }

  const analysisComplete = hasCompletedAnalysis(doc);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/documents/${doc.id}`}
        className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700 print:hidden"
      >
        ← Back to document
      </Link>

      {error && (
        <p role="status" className="mb-4 text-xs text-gray-500">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Risk report</h1>
        {/* Graceful fallback: disabled button while analysis is incomplete */}
        <span
          title={
            analysisComplete
              ? "Download as PDF"
              : "Analysis is not complete yet — a risk score is required before the report can be downloaded."
          }
        >
          <button
            onClick={handleDownloadPdf}
            disabled={!analysisComplete}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 print:hidden"
          >
            Download PDF
          </button>
        </span>
      </div>

      {!analysisComplete && (
        <p className="mt-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 print:hidden">
          This document hasn&rsquo;t completed analysis yet. The PDF download
          will be enabled once a risk score is available.
        </p>
      )}

      {/* Printable summary view */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{doc.title}</h2>
        <p className="mt-1 text-sm text-gray-500">Status: {doc.status}</p>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">Risk score</dt>
            <dd className="font-semibold text-gray-900">
              {doc.riskScore != null ? `${doc.riskScore}/100` : "—"}
            </dd>
          </div>
          {doc.stellarTxHash && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-gray-500">Stellar transaction hash</dt>
              <dd className="max-w-[60%] truncate font-mono text-gray-800">
                {doc.stellarTxHash}
              </dd>
            </div>
          )}
          {doc.anchoredAt && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-gray-500">Anchored at</dt>
              <dd className="text-gray-800">
                {new Date(doc.anchoredAt).toLocaleString()}
              </dd>
            </div>
          )}
          {doc.fileHash && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-gray-500">File hash</dt>
              <dd className="max-w-[60%] truncate font-mono text-gray-800">
                {doc.fileHash}
              </dd>
            </div>
          )}
        </dl>

        <h3 className="mt-6 text-sm font-semibold text-gray-900">Risk flags</h3>
        {doc.riskFlags && doc.riskFlags.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {doc.riskFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-500">No risk flags detected.</p>
        )}
      </div>
    </main>
  );
}
