"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
<<<<<<< HEAD:frontend/app/[locale]/(protected)/documents/[id]/verify/page.tsx
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useDateFormatting } from "@/i18n/formatting";
import { ApiError, request } from "@/lib/api-client";
import { apiUrl } from "@/lib/api-config";
=======
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { stellarTxUrl } from "@/lib/stellar";
>>>>>>> c4aa8fa (feat: persist failed webhooks for replay; unify Stellar explorer links):frontend/app/(protected)/documents/[id]/verify/page.tsx

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const WS_BASE = (
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001"
).replace(/^http/, "ws");

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type VerifyState = "pre" | "processing" | "post";

interface DocumentSummary {
  id: string;
  title: string;
  fileHash: string;
  status: string;
}

interface VerificationRecord {
  transactionHash: string;
  anchoredAt: string;
  ledger: number;
  qrCodeUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function documentPath(docId: string, suffix = ""): string {
  return apiUrl(`/documents/${encodeURIComponent(docId)}${suffix}`);
}

function truncateHash(hash: string, chars = 10): string {
  if (hash.length <= chars * 2) return hash;
  return `${hash.slice(0, chars)}…${hash.slice(-chars)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Thin animated progress bar. */
function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-blue-500 transition-all duration-500"
        style={{ width: `${Math.max(4, value)}%` }}
      />
    </div>
  );
}

/** Copyable text field. */
function CopyField({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const t = useTranslations("documentVerify");
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-gray-500">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 truncate font-mono text-sm text-blue-600 underline hover:text-blue-800"
          >
            {value}
          </a>
        ) : (
          <span className="flex-1 truncate font-mono text-sm text-gray-700">
            {value}
          </span>
        )}
        <button
          onClick={handleCopy}
          aria-label={t("copyLabel", { label })}
          className="shrink-0 rounded-md bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {copied ? "✓" : t("copy")}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-verification state
// ─────────────────────────────────────────────────────────────────────────────

function PreVerification({
  doc,
  onAnchor,
  anchoring,
}: {
  doc: DocumentSummary;
  onAnchor: () => void;
  anchoring: boolean;
}) {
  const t = useTranslations("documentVerify.pre");
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <h2 className="mb-2 text-sm font-semibold text-blue-800">
          {t("explainerTitle")}
        </h2>
        <p className="text-sm text-blue-700">{t("explainerBody")}</p>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-gray-500">{t("document")}</p>
        <p className="text-sm font-semibold text-gray-900">{doc.title}</p>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-gray-500">
          {t("hashPreview")}
        </p>
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700 break-all">
          {doc.fileHash}
        </p>
      </div>

      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
        <p className="text-xs text-gray-500">
          {t("estimatedCost")}
        </p>
      </div>

      <button
        onClick={onAnchor}
        disabled={anchoring}
        aria-busy={anchoring}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {anchoring && (
          <svg
            className="h-4 w-4 animate-spin"
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
        {t("anchor")}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Processing state
// ─────────────────────────────────────────────────────────────────────────────

function ProcessingView({
  progress,
  statusMsg,
}: {
  progress: number;
  statusMsg: string;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <svg
        className="h-12 w-12 animate-spin text-blue-500"
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
      <div className="w-full space-y-2">
        <p
          className="text-center text-sm font-medium text-gray-700"
          role="status"
          aria-live="polite"
        >
          {statusMsg}
        </p>
        <ProgressBar value={progress} />
        <p className="text-center text-xs text-gray-400">{progress}%</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-verification state
// ─────────────────────────────────────────────────────────────────────────────

function PostVerification({
  docId,
  verification,
}: {
  docId: string;
  verification: VerificationRecord;
}) {
  const t = useTranslations("documentVerify.post");
  const { formatDateTime } = useDateFormatting();

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* Big green checkmark */}
      <div className="flex flex-col items-center gap-2 py-4">
        <span
          className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600"
          aria-hidden="true"
        >
          <svg
            className="h-10 w-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </span>
        <h2 className="text-lg font-bold text-gray-900">
          {t("successTitle")}
        </h2>
        <p className="text-center text-sm text-gray-500">
          {t("successBody")}
        </p>
      </div>

      {/* Transaction details */}
      <div className="space-y-4">
        <CopyField
          label={t("txHash")}
          value={verification.transactionHash}
          href={stellarTxUrl(verification.transactionHash)}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">
              {t("anchoredAt")}
            </p>
            <p className="text-sm text-gray-800">
              {formatDateTime(verification.anchoredAt)}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">{t("ledger")}</p>
            <p className="text-sm text-gray-800">#{verification.ledger}</p>
          </div>
        </div>

        {/* QR code */}
        {verification.qrCodeUrl ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs font-medium text-gray-500">{t("qrCode")}</p>
            <img
              src={verification.qrCodeUrl}
              alt={t("qrAlt")}
              className="h-36 w-36 rounded-lg border border-gray-200 object-contain p-1"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs font-medium text-gray-500">{t("qrCode")}</p>
            {/* Inline SVG placeholder QR when backend QR endpoint not yet available */}
            <div className="flex h-36 w-36 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
              <svg
                viewBox="0 0 100 100"
                className="h-28 w-28"
                aria-label={t("qrPlaceholder")}
              >
                {/* finder pattern top-left */}
                <rect
                  x="5"
                  y="5"
                  width="30"
                  height="30"
                  rx="3"
                  fill="none"
                  stroke="#111"
                  strokeWidth="4"
                />
                <rect x="13" y="13" width="14" height="14" rx="1" fill="#111" />
                {/* finder pattern top-right */}
                <rect
                  x="65"
                  y="5"
                  width="30"
                  height="30"
                  rx="3"
                  fill="none"
                  stroke="#111"
                  strokeWidth="4"
                />
                <rect x="73" y="13" width="14" height="14" rx="1" fill="#111" />
                {/* finder pattern bottom-left */}
                <rect
                  x="5"
                  y="65"
                  width="30"
                  height="30"
                  rx="3"
                  fill="none"
                  stroke="#111"
                  strokeWidth="4"
                />
                <rect x="13" y="73" width="14" height="14" rx="1" fill="#111" />
                {/* data area placeholder */}
                {[45, 55, 65, 75, 85].map((x) =>
                  [45, 55, 65, 75, 85].map((y) => (
                    <rect
                      key={`${x}-${y}`}
                      x={x}
                      y={y}
                      width="7"
                      height="7"
                      fill={Math.random() > 0.5 ? "#111" : "none"}
                    />
                  )),
                )}
              </svg>
            </div>
            <p className="text-xs text-gray-400">
              {t("qrPending")}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={handlePrint}
          className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 print:hidden"
        >
          {t("downloadCertificate")}
        </button>
        <Link
          href={`/documents/${docId}`}
          className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 print:hidden"
        >
          {t("backToDocument")}
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function VerifyPage() {
  const t = useTranslations("documentVerify");
  const { formatDateTime } = useDateFormatting();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const docId = params.id;

  const [doc, setDoc] = useState<DocumentSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const [viewState, setViewState] = useState<VerifyState>("pre");
  const [anchoring, setAnchoring] = useState(false);
  const [anchorError, setAnchorError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState(() => t("submitting"));
  const [verification, setVerification] = useState<VerificationRecord | null>(
    null,
  );

  const wsRef = useRef<WebSocket | null>(null);

  // ── Fetch document metadata ────────────────────────────────────────────
  useEffect(() => {
    if (!docId) return;

    request<DocumentSummary>(documentPath(docId))
      .then((data) => {
        // If already verified, redirect back to detail page
        if (data.status === "VERIFIED") {
          router.replace(`/documents/${docId}`);
          return;
        }
        setDoc(data);
      })
      .catch((err) =>
        setLoadError(
          err instanceof ApiError && err.status === 404
            ? t("notFound")
            : t("loadError"),
        ),
      )
      .finally(() => setPageLoading(false));
  }, [docId, router, t]);

  // ── WebSocket progress handler ─────────────────────────────────────────
  const connectProgressWs = useCallback(() => {
    if (!docId || typeof window === "undefined") return;
    const ws = new WebSocket(`${WS_BASE}/documents/${docId}/verify/progress`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          progress?: number;
          message?: string;
          status?: string;
        };
        if (payload.progress !== undefined) setProgress(payload.progress);
        if (payload.message) setStatusMsg(payload.message);
        if (payload.status === "VERIFIED") {
          ws.close();
          // Fetch final verification record
          fetchVerification();
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => ws.close();
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch verification record after anchoring ──────────────────────────
  const fetchVerification = useCallback(async () => {
    if (!docId) return;
    try {
      const data = await request<VerificationRecord>(
        documentPath(docId, "/verification"),
      );
      setVerification(data);
      setViewState("post");
    } catch {
      // Fall back to a minimal record derived from what we know
      setVerification({
        transactionHash: t("pendingTxHash"),
        anchoredAt: new Date().toISOString(),
        ledger: 0,
      });
      setViewState("post");
    }
  }, [docId, t]);

  // ── Anchor handler ─────────────────────────────────────────────────────
  async function handleAnchor() {
    if (!docId) return;
    setAnchoring(true);
    setAnchorError(null);
    setProgress(0);
    setStatusMsg(t("submitting"));

    try {
      await request(documentPath(docId, "/verify"), { method: "POST" });

      // Switch to processing view and open WS for real-time updates
      setViewState("processing");
      connectProgressWs();

      // Simulate progress advancement when WS is unavailable
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return prev;
          }
          return prev + 10;
        });
      }, 800);

      // Poll for completion (fallback when WS is not available)
      const poll = async () => {
        await new Promise((r) => setTimeout(r, 8000));
        const data = await request<VerificationRecord>(
          documentPath(docId, "/verification"),
        );
        clearInterval(interval);
        setProgress(100);
        setVerification(data);
        setViewState("post");
        wsRef.current?.close();
      };

      poll().catch(() => {
        // WS/poll failed — move to post with partial info
        clearInterval(interval);
        setProgress(100);
        fetchVerification();
      });
    } catch {
      setAnchorError(t("anchorError"));
      setAnchoring(false);
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => wsRef.current?.close();
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <main
        className="mx-auto max-w-xl px-4 py-8"
        aria-busy="true"
        aria-label={t("loading")}
      >
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-xl bg-gray-200"
            />
          ))}
        </div>
      </main>
    );
  }

  if (loadError || !doc) {
    return (
      <main className="mx-auto max-w-xl px-4 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">
            {loadError ?? t("notFound")}
          </p>
          <Link
            href="/documents"
            className="mt-3 block text-sm underline text-red-700"
          >
            {t("backToDocuments")}
          </Link>
        </div>
      </main>
    );
  }

  const title =
    viewState === "pre"
      ? t("titles.pre")
      : viewState === "processing"
        ? t("titles.processing")
        : t("titles.post");

  return (
    <main className="mx-auto max-w-xl px-4 py-8 sm:px-6 print:py-4">
      {/* Page header */}
      <div className="mb-6">
        <Link
          href={`/documents/${docId}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 print:hidden"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t("backToDocument")}
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">{doc.title}</p>
      </div>

      {/* Content card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        {viewState === "pre" && (
          <PreVerification
            doc={doc}
            onAnchor={handleAnchor}
            anchoring={anchoring}
          />
        )}
        {viewState === "processing" && (
          <ProcessingView progress={progress} statusMsg={statusMsg} />
        )}
        {viewState === "post" && verification && (
          <PostVerification docId={docId} verification={verification} />
        )}

        {anchorError && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {anchorError}
          </p>
        )}
      </div>

      {/* Print-only header */}
      <div className="hidden print:block mt-4">
        <p className="text-xs text-gray-400">
          {t("printedCertificate", { date: formatDateTime(new Date().toISOString()) })}
        </p>
      </div>
    </main>
  );
}
