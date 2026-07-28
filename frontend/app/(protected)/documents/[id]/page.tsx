"use client";
import { API_URL } from "@/lib/api-config";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const WS_BASE = (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001").replace(/^http/, "ws");

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DocumentStatus = "PENDING" | "ANALYZING" | "VERIFIED" | "FLAGGED" | "REJECTED";

interface DocumentDetail {
  id: string;
  title: string;
  fileHash: string;
  status: DocumentStatus;
  uploadedAt: string;
  updatedAt: string;
}

interface RiskFlag {
  name: string;
  weight: number;
  detected: boolean;
  contribution: number;
}

interface RiskData {
  score: number;
  flags: RiskFlag[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateHash(hash: string, chars = 12): string {
  if (hash.length <= chars * 2) return hash;
  return `${hash.slice(0, chars)}…${hash.slice(-chars)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status colour helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<DocumentStatus, string> = {
  PENDING:   "bg-yellow-100 text-yellow-800",
  ANALYZING: "bg-blue-100   text-blue-800",
  VERIFIED:  "bg-green-100  text-green-800",
  FLAGGED:   "bg-orange-100 text-orange-800",
  REJECTED:  "bg-red-100    text-red-800",
};

const RISK_COLOUR = (score: number) => {
  if (score < 30) return { stroke: "#22c55e", text: "text-green-600" };
  if (score < 60) return { stroke: "#f59e0b", text: "text-amber-500" };
  return { stroke: "#ef4444", text: "text-red-600" };
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

/** Circular SVG gauge showing the risk score (0-100). */
function RiskGauge({ score }: { score: number }) {
  const R = 52;
  const circumference = 2 * Math.PI * R;
  const offset = circumference - (score / 100) * circumference;
  const { stroke, text } = RISK_COLOUR(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="128" height="128" viewBox="0 0 128 128" aria-label={`Risk score: ${score} out of 100`} role="img">
        <circle cx="64" cy="64" r={R} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle
          cx="64"
          cy="64"
          r={R}
          fill="none"
          stroke={stroke}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 64 64)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text x="64" y="60" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold" fill="currentColor" style={{ fontSize: 26, fontWeight: 700 }}>
          {score}
        </text>
        <text x="64" y="84" textAnchor="middle" dominantBaseline="middle" fill="#6b7280" style={{ fontSize: 11 }}>
          / 100
        </text>
      </svg>
      <p className={`text-sm font-semibold ${text}`}>
        {score < 30 ? "Low Risk" : score < 60 ? "Medium Risk" : "High Risk"}
      </p>
    </div>
  );
}

/** Card for a single risk flag. */
function FlagCard({ flag }: { flag: RiskFlag }) {
  return (
    <div className={`rounded-xl border p-4 ${flag.detected ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">{flag.name}</span>
        <span className={`text-lg ${flag.detected ? "text-red-500" : "text-green-500"}`} aria-label={flag.detected ? "Detected" : "Not detected"}>
          {flag.detected ? "✗" : "✓"}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>Weight: {(flag.weight * 100).toFixed(0)}%</span>
        <span>Contribution: {flag.contribution.toFixed(1)}</span>
      </div>
    </div>
  );
}

const STATUS_ORDER: DocumentStatus[] = ["PENDING", "ANALYZING", "VERIFIED"];

/** Vertical status timeline. */
function StatusTimeline({ status }: { status: DocumentStatus }) {
  const steps = STATUS_ORDER;
  const currentIdx = steps.indexOf(status === "FLAGGED" || status === "REJECTED" ? "VERIFIED" : status);

  return (
    <ol className="relative ml-3 border-l border-gray-200" aria-label="Document status timeline">
      {steps.map((step, i) => {
        const done = i < currentIdx || (status === "VERIFIED" && step === "VERIFIED");
        const active =
          i === currentIdx ||
          ((status === "FLAGGED" || status === "REJECTED") && step === "VERIFIED");
        const label = step === "VERIFIED"
          ? (status === "FLAGGED" ? "FLAGGED" : status === "REJECTED" ? "REJECTED" : "VERIFIED")
          : step;

        return (
          <li key={step} className="mb-6 ml-6">
            <span
              className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white text-xs font-bold
                ${done ? "bg-green-500 text-white" : active ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-500"}`}
              aria-current={active ? "step" : undefined}
            >
              {done ? "✓" : i + 1}
            </span>
            <p className={`text-sm font-semibold ${active ? "text-blue-700" : done ? "text-gray-700" : "text-gray-400"}`}>
              {label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading document details">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="space-y-3">
            <div className="h-5 w-1/3 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Share modal
// ─────────────────────────────────────────────────────────────────────────────

function ShareModal({ docId, onClose }: { docId: string; onClose: () => void }) {
  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/documents/${docId}`;
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share document"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-base font-semibold text-gray-900">Share Document</h2>
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
          <span className="flex-1 truncate text-gray-600">{shareUrl}</span>
          <button
            onClick={handleCopy}
            className="shrink-0 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const docId = params.id;

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [risk, setRisk] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // ── WebSocket for real-time status updates (FE-06) ──────────────────────
  const wsRef = useRef<WebSocket | null>(null);

  const setupWebSocket = useCallback(() => {
    if (!docId || typeof window === "undefined") return;
    const ws = new WebSocket(`${WS_BASE}/documents/${docId}/status`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { status?: DocumentStatus };
        if (payload.status) {
          setDoc((prev) => prev ? { ...prev, status: payload.status as DocumentStatus } : prev);
        }
      } catch {
        // malformed message — ignore
      }
    };

    ws.onerror = () => ws.close();
    ws.onclose = () => {
      // Reconnect after 5 s (simple back-off)
      setTimeout(setupWebSocket, 5000);
    };

    return () => ws.close();
  }, [docId]);

  // ── Fetch document + risk data ─────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!docId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = getAuthHeaders();
      const [docRes, riskRes] = await Promise.all([
        fetch(`${API_URL}/documents/${docId}`, { headers }),
        fetch(`${API_URL}/documents/${docId}/risk`, { headers }),
      ]);

      if (!docRes.ok) {
        throw new Error(docRes.status === 404 ? "Document not found." : `Failed to load document (${docRes.status})`);
      }

      const docData: DocumentDetail = await docRes.json();
      setDoc(docData);

      if (riskRes.ok) {
        const riskData: RiskData = await riskRes.json();
        setRisk(riskData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load document.");
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const cleanup = setupWebSocket();
    return () => {
      cleanup?.();
      wsRef.current?.close();
    };
  }, [setupWebSocket]);

  // ── Verify on Stellar ──────────────────────────────────────────────────
  async function handleVerify() {
    if (!docId) return;
    setVerifying(true);
    try {
      const res = await fetch(`${API_URL}/documents/${docId}/verify`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Verification failed (${res.status})`);
      // Navigate to verify page to show progress + result
      router.push(`/documents/${docId}/verify`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) return <Skeleton />;

  if (error || !doc) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">{error ?? "Document not found."}</p>
          <button
            onClick={fetchData}
            className="mt-3 text-sm underline text-red-700 hover:no-underline"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const canVerify = doc.status === "PENDING" || doc.status === "FLAGGED";

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      {/* ── Header ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{doc.title}</h1>
            <p className="mt-1 font-mono text-xs text-gray-500" title={doc.fileHash}>
              {truncateHash(doc.fileHash)}
            </p>
            <p className="mt-1 text-xs text-gray-500">Uploaded {formatDate(doc.uploadedAt)}</p>
          </div>
          <StatusBadge status={doc.status} />
        </div>
      </div>

      {/* ── Risk panel ── */}
      {risk ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Risk Analysis</h2>
          <div className="flex flex-wrap items-start gap-8">
            <RiskGauge score={risk.score} />
            <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {risk.flags.map((flag) => (
                <FlagCard key={flag.name} flag={flag} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6">
          <p className="text-sm text-gray-500">Risk analysis not yet available for this document.</p>
        </div>
      )}

      {/* ── Status timeline + Actions ── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Status Timeline</h2>
          <StatusTimeline status={doc.status} />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Actions</h2>
          <div className="flex flex-col gap-3">
            {canVerify && (
              <button
                onClick={handleVerify}
                disabled={verifying}
                aria-busy={verifying}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {verifying && (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                Verify on Stellar
              </button>
            )}

            <a
              href={`${API_URL}/documents/${docId}/report`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Download Report
            </a>

            <a
              href={`/documents/${docId}/dispute`}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              File Dispute
            </a>

            <button
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Share
            </button>
          </div>
        </div>
      </div>

      {shareOpen && <ShareModal docId={docId} onClose={() => setShareOpen(false)} />}
    </main>
  );
}
