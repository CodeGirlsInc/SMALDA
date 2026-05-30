"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";

interface VerificationRecord {
  status: "CONFIRMED" | "PENDING" | "FAILED";
  stellarTxHash: string;
  stellarLedger: number;
  anchoredAt: string;
}

interface DocumentDetail {
  id: string;
  title: string;
  uploadedAt: string;
  fileSize: number;
  mimeType: string;
  status: string;
  riskScore: number | null;
  riskFlags: string[] | null;
  riskReport: string | null;
  verification: VerificationRecord | null;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  VERIFIED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  FLAGGED: "bg-orange-100 text-orange-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

function RiskScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-sm text-gray-400">N/A</span>;
  const color = score < 30 ? "text-green-700 bg-green-100" : score < 70 ? "text-amber-700 bg-amber-100" : "text-red-700 bg-red-100";
  const label = score < 30 ? "LOW" : score < 70 ? "MEDIUM" : "HIGH";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${color}`}
      aria-label={`Risk score ${score}, level ${label}`}>
      {score} <span className="text-xs font-normal">{label}</span>
    </span>
  );
}

function RiskFlagsDisplay({ flags }: { flags: string[] | null }) {
  if (flags == null) return <span className="text-sm text-gray-400">Not yet assessed</span>;
  if (flags.length === 0) return <span className="text-sm text-green-600">No flags detected</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {flags.map((f) => (
        <span key={f} className="rounded-full border border-red-200 bg-red-50 px-3 py-0.5 text-xs font-medium text-red-700">
          {f.replace(/_/g, " ")}
        </span>
      ))}
    </div>
  );
}

function VerificationStatusCard({ record }: { record: VerificationRecord | null }) {
  if (!record) return <p className="text-sm text-gray-400">Not yet verified</p>;
  const colors = { CONFIRMED: "text-green-700", PENDING: "text-yellow-700", FAILED: "text-red-700" };
  return (
    <div className="space-y-2 text-sm">
      <p className={`font-semibold ${colors[record.status]}`}>{record.status}</p>
      {record.stellarTxHash && (
        <p className="font-mono text-xs text-gray-600 break-all">{record.stellarTxHash}</p>
      )}
      <p className="text-gray-500">Ledger: {record.stellarLedger}</p>
      <p className="text-gray-500">Anchored: {new Date(record.anchoredAt).toLocaleString()}</p>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const fetchDoc = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/module/documents/${id}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } }
      );
      if (res.status === 404 || res.status === 403) { setNotFound(true); return; }
      if (!res.ok) throw new Error();
      setDoc(await res.json());
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDoc(); }, [fetchDoc]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-6 rounded bg-gray-200" />
        ))}
      </div>
    );
  }

  if (notFound || !doc) {
    return (
      <div className="flex flex-col items-center gap-3 p-12 text-center">
        <p className="text-lg font-semibold text-gray-700">Document not found</p>
        <p className="text-sm text-gray-500">
          This document does not exist or you do not have access to it.
        </p>
      </div>
    );
  }

  const canRequestVerification = doc.status === "PENDING" || doc.status === "FLAGGED";

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{doc.title}</h1>
        <StatusBadge status={doc.status} />
      </div>

      {/* Metadata */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-400">Uploaded</dt>
            <dd className="text-gray-900">{new Date(doc.uploadedAt).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-gray-400">File size</dt>
            <dd className="text-gray-900">{formatBytes(doc.fileSize)}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Type</dt>
            <dd className="text-gray-900">{doc.mimeType}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Risk score</dt>
            <dd><RiskScoreBadge score={doc.riskScore} /></dd>
          </div>
        </dl>
      </div>

      {/* Risk flags */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Risk Flags</h2>
        <RiskFlagsDisplay flags={doc.riskFlags} />
      </div>

      {/* Verification */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Stellar Verification</h2>
        <VerificationStatusCard record={doc.verification} />
      </div>

      {/* Verification request button */}
      {canRequestVerification && (
        <button
          type="button"
          onClick={async () => {
            await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/module/documents/${doc.id}/verify`,
              {
                method: "POST",
                headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
              }
            );
            fetchDoc();
          }}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Request Verification
        </button>
      )}

      {/* Risk report accordion */}
      {doc.riskReport && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setReportOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700"
            aria-expanded={reportOpen}
          >
            Risk Report
            {reportOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {reportOpen && (
            <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-700 whitespace-pre-wrap">
              {doc.riskReport}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
