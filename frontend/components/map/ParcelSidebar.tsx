"use client";

import React, { useEffect, useRef } from "react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export type DocumentStatus = "VERIFIED" | "PENDING" | "FLAGGED" | "REJECTED";

export interface ParcelDocument {
  id: string;
  name: string;
  status: DocumentStatus;
  /** 0–100 */
  riskScore: number;
  ownerName: string | null;
  isOwnedByViewer: boolean;
  stellarAnchorDate: string | null;
  stellarTxHash: string | null;
  flags: string[];
  detailsUrl: string;
}

interface ParcelSidebarProps {
  document: ParcelDocument | null;
  loading?: boolean;
  open: boolean;
  onClose: () => void;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const STATUS_STYLES: Record<DocumentStatus, string> = {
  VERIFIED: "bg-green-100 text-green-800",
  PENDING:  "bg-yellow-100 text-yellow-800",
  FLAGGED:  "bg-red-100 text-red-800",
  REJECTED: "bg-gray-100 text-gray-700",
};

function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

/** Compact risk score gauge — reuses FE-19 design at size="sm" */
function RiskGauge({ score }: { score: number }) {
  const colour =
    score >= 70 ? "bg-red-500" : score >= 40 ? "bg-yellow-400" : "bg-green-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full ${colour} transition-all`}
          style={{ width: `${score}%` }}
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Risk score: ${score} out of 100`}
        />
      </div>
      <span className="text-xs font-medium text-gray-600">{score}/100</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function ParcelSidebar({
  document,
  loading = false,
  open,
  onClose,
}: ParcelSidebarProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Trap focus inside panel when open
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <>
      {/* Backdrop — clicking it closes the sidebar */}
      {open && (
        <div
          className="absolute inset-0 z-10"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      {/* Slide-in panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Parcel detail"
        tabIndex={-1}
        className={`absolute right-0 top-0 z-20 h-full w-80 transform bg-white shadow-xl transition-transform duration-300 ease-in-out focus:outline-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Parcel Detail</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close parcel detail"
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-4">
          {loading && (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading parcel data">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-4 animate-pulse rounded bg-gray-200"
                  style={{ width: i === 1 ? "60%" : i === 2 ? "80%" : "40%" }}
                />
              ))}
            </div>
          )}

          {!loading && !document && (
            <p className="text-sm text-gray-500">No parcel selected.</p>
          )}

          {!loading && document && (
            <div className="flex flex-col gap-4">
              {/* Name + status */}
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-gray-900 leading-snug">
                  {document.name}
                </p>
                <StatusBadge status={document.status} />
              </div>

              {/* Risk score — only show to owner */}
              {document.isOwnedByViewer && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Risk Score
                  </p>
                  <RiskGauge score={document.riskScore} />
                </div>
              )}

              {/* Ownership */}
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Owner
                </p>
                <p className="text-sm text-gray-800">
                  {document.isOwnedByViewer
                    ? document.ownerName ?? "You"
                    : "Anonymous"}
                </p>
              </div>

              {/* Stellar verification */}
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Verification
                </p>
                {document.status === "VERIFIED" && document.stellarAnchorDate ? (
                  <p className="flex items-center gap-1 text-sm text-green-700">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 shrink-0"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Verified on Stellar ·{" "}
                    {new Date(document.stellarAnchorDate).toLocaleDateString()}
                  </p>
                ) : (
                  <p className="flex items-center gap-1 text-sm text-yellow-700">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 shrink-0"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Not verified
                  </p>
                )}
              </div>

              {/* Flags — only if FLAGGED */}
              {document.status === "FLAGGED" && document.flags.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Flags Raised
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {document.flags.map((flag, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-1 text-xs text-red-700"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true" />
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quick links */}
              <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                <a
                  href={document.detailsUrl}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  View full details →
                </a>
                {document.stellarTxHash && (
                  <a
                    href={`https://stellar.expert/explorer/public/tx/${document.stellarTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    View on Stellar Explorer ↗
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}