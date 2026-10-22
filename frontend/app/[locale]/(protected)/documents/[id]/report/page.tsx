"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { jsPDF } from "jspdf";
import { Link } from "@/i18n/navigation";
import { useDateFormatting } from "@/i18n/formatting";
import { request } from "@/lib/api-client";
import { apiUrl } from "@/lib/api-config";

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
  const t = useTranslations("documentReport");
  const tStatus = useTranslations("documents.status");
  const { formatDateTime } = useDateFormatting();
  const params = useParams<{ id: string }>();
  const docId = params.id;

  const [doc, setDoc] = useState<DocumentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId) return;
    request<DocumentReport>(apiUrl(`/documents/${encodeURIComponent(docId)}`))
      .then(setDoc)
      .catch(() => {
        // Backend may be unavailable — fall back to sample data.
        setDoc(MOCK_DOCUMENT);
        setError(t("sampleData"));
      })
      .finally(() => setLoading(false));
  }, [docId, t]);

  function statusLabel(status: string): string {
    const key = status.toLowerCase();
    return tStatus.has(key) ? tStatus(key) : status;
  }

  function handleDownloadPdf() {
    if (!doc || !hasCompletedAnalysis(doc)) return;
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text(t("pdf.title"), 14, 20);
    pdf.setFontSize(11);
    pdf.text(t("pdf.document", { title: doc.title }), 14, 32);
    pdf.text(t("pdf.status", { status: statusLabel(doc.status) }), 14, 38);
    pdf.text(t("pdf.riskScore", { score: doc.riskScore ?? 0 }), 14, 44);
    if (doc.stellarTxHash) {
      pdf.text(t("pdf.stellarTxHash", { hash: doc.stellarTxHash }), 14, 50);
    }
    if (doc.anchoredAt) {
      pdf.text(t("pdf.anchoredAt", { date: formatDateTime(doc.anchoredAt) }), 14, 56);
    }
    if (doc.riskFlags && doc.riskFlags.length > 0) {
      pdf.text(t("pdf.riskFlags"), 14, 66);
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
          {error ?? t("notFound")}
        </p>
        <Link href="/documents" className="mt-3 block text-sm text-blue-600 underline">
          {t("backToDocuments")}
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
        {t("backToDocument")}
      </Link>

      {error && (
        <p role="status" className="mb-4 text-xs text-gray-500">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        {/* Graceful fallback: disabled button while analysis is incomplete */}
        <span
          title={
            analysisComplete ? t("downloadHint") : t("downloadDisabledHint")
          }
        >
          <button
            onClick={handleDownloadPdf}
            disabled={!analysisComplete}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 print:hidden"
          >
            {t("downloadPdf")}
          </button>
        </span>
      </div>

      {!analysisComplete && (
        <p className="mt-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 print:hidden">
          {t("analysisIncomplete")}
        </p>
      )}

      {/* Printable summary view */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{doc.title}</h2>
        <p className="mt-1 text-sm text-gray-500">
          {t("status", { status: statusLabel(doc.status) })}
        </p>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <dt className="text-gray-500">{t("fields.riskScore")}</dt>
            <dd className="font-semibold text-gray-900">
              {doc.riskScore != null ? `${doc.riskScore}/100` : "—"}
            </dd>
          </div>
          {doc.stellarTxHash && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-gray-500">{t("fields.stellarTxHash")}</dt>
              <dd className="max-w-[60%] truncate font-mono text-gray-800">
                {doc.stellarTxHash}
              </dd>
            </div>
          )}
          {doc.anchoredAt && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-gray-500">{t("fields.anchoredAt")}</dt>
              <dd className="text-gray-800">
                {formatDateTime(doc.anchoredAt)}
              </dd>
            </div>
          )}
          {doc.fileHash && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-gray-500">{t("fields.fileHash")}</dt>
              <dd className="max-w-[60%] truncate font-mono text-gray-800">
                {doc.fileHash}
              </dd>
            </div>
          )}
        </dl>

        <h3 className="mt-6 text-sm font-semibold text-gray-900">
          {t("fields.riskFlags")}
        </h3>
        {doc.riskFlags && doc.riskFlags.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {doc.riskFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-500">{t("noRiskFlags")}</p>
        )}
      </div>
    </main>
  );
}
