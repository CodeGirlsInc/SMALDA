"use client";

import { useState } from "react";
import { X, Loader2, Trash2 } from "lucide-react";

export interface ShareEntry {
  id: string;
  email: string;
}

interface ShareModalProps {
  documentId: string;
  existingShares?: ShareEntry[];
  onShare?: (documentId: string, email: string) => Promise<void>;
  onRevoke?: (documentId: string, shareId: string) => Promise<void>;
  onClose: () => void;
}

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function ShareModal({
  documentId,
  existingShares = [],
  onShare,
  onRevoke,
  onClose,
}: ShareModalProps) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [shares, setShares] = useState<ShareEntry[]>(existingShares);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError("");

    try {
      setSubmitting(true);
      await onShare?.(documentId, email);
      setShares((prev) => [...prev, { id: Date.now().toString(), email }]);
      setEmail("");
    } catch {
      setSubmitError("Failed to share document. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    try {
      setRevokingId(shareId);
      await onRevoke?.(documentId, shareId);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 id="share-modal-title" className="text-base font-semibold text-gray-800">
            Share Document
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Share form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <label htmlFor="share-email" className="block text-sm font-medium text-gray-700">
            Recipient email
          </label>
          <div className="flex gap-2">
            <input
              id="share-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
              placeholder="user@example.com"
              className={`flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                emailError ? "border-red-400" : "border-gray-300"
              }`}
              aria-describedby={emailError ? "email-error" : undefined}
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-1"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Share
            </button>
          </div>
          {emailError && (
            <p id="email-error" className="text-xs text-red-500" role="alert">
              {emailError}
            </p>
          )}
          {submitError && (
            <p className="text-xs text-red-500" role="alert">
              {submitError}
            </p>
          )}
        </form>

        {/* Current shares */}
        {shares.length > 0 && (
          <div className="px-5 pb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Shared with
            </p>
            <ul className="space-y-2">
              {shares.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm text-gray-700">
                  <span className="truncate">{s.email}</span>
                  <button
                    onClick={() => handleRevoke(s.id)}
                    disabled={revokingId === s.id}
                    className="ml-3 text-gray-400 hover:text-red-500 disabled:opacity-50"
                    aria-label={`Revoke access for ${s.email}`}
                  >
                    {revokingId === s.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
