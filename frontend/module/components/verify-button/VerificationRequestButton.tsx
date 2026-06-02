"use client";

import { useState } from "react";

type DocumentStatus = "PENDING" | "FLAGGED" | "ANALYZING" | "VERIFIED" | string;

interface VerificationRequestButtonProps {
  documentId: string;
  currentStatus: DocumentStatus;
  onQueued?: () => void;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

export default function VerificationRequestButton({
  documentId,
  currentStatus,
  onQueued,
}: VerificationRequestButtonProps) {
  const [status, setStatus] = useState<DocumentStatus>(currentStatus);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  function showToast(message: string, type: Toast["type"]) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleRequest() {
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/documents/${documentId}/verify`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}`,
          },
        }
      );
      if (res.status === 202) {
        setStatus("ANALYZING");
        showToast("Verification queued", "success");
        onQueued?.();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message ?? "Verification request failed.", "error");
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  const isRequestable = status === "PENDING" || status === "FLAGGED";
  const isQueued = status === "ANALYZING";
  const isVerified = status === "VERIFIED";

  return (
    <div className="relative inline-block">
      {isVerified ? (
        <span className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Verified on Stellar
        </span>
      ) : isQueued ? (
        <button
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 opacity-75"
        >
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
          Verification Queued
        </button>
      ) : isRequestable ? (
        <button
          onClick={handleRequest}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading && (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          )}
          Request Verification
        </button>
      ) : null}

      {toast && (
        <div
          className={`absolute left-0 top-12 z-30 min-w-max rounded-lg px-4 py-2 text-sm text-white shadow ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
