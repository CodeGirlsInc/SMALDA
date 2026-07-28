"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function logout() {
  localStorage.removeItem("auth-token");
  document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_KEY = "last_data_export_ts";

function getLastExportTs(): number | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return v ? Number(v) : null;
}

function setLastExportTs() {
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
}

function msUntilNextExport(): number {
  const last = getLastExportTs();
  if (!last) return 0;
  return Math.max(0, last + COOLDOWN_MS - Date.now());
}

function formatCountdown(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Delete confirmation modal
// ---------------------------------------------------------------------------

interface DeleteModalProps {
  onConfirm: (password: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}

function DeleteConfirmationModal({
  onConfirm,
  onCancel,
  isLoading,
  error,
}: DeleteModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const canSubmit =
    confirmText === "DELETE" && password.length > 0 && !isLoading;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-6 space-y-4">
        <h2
          id="delete-modal-title"
          className="text-xl font-semibold text-red-700"
        >
          Confirm account deletion
        </h2>

        <p className="text-sm text-gray-700">
          This action is <strong>permanent and irreversible</strong>. All your
          documents, verifications, and personal data will be deleted.
        </p>

        <div>
          <label
            htmlFor="confirm-text"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Type <strong>DELETE</strong> to confirm
          </label>
          <input
            id="confirm-text"
            ref={inputRef}
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="DELETE"
            autoComplete="off"
          />
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Current password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="Enter your password"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(password)}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {isLoading ? "Deleting…" : "Delete my account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsDataPage() {
  const router = useRouter();

  // ── Export state ───────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [cooldownMs, setCooldownMs] = useState<number>(msUntilNextExport);

  // Tick countdown every minute
  useEffect(() => {
    if (cooldownMs <= 0) return;
    const timer = setInterval(() => {
      const remaining = msUntilNextExport();
      setCooldownMs(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 60_000);
    return () => clearInterval(timer);
  }, [cooldownMs]);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`${API_BASE}/api/users/me/export`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
      setLastExportTs();
      setCooldownMs(COOLDOWN_MS);
    } catch (err: unknown) {
      setExportError(
        err instanceof Error ? err.message : "Export failed. Please try again."
      );
    } finally {
      setIsExporting(false);
    }
  };

  // ── Deletion state ─────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteConfirm = async (password: string) => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`${API_BASE}/api/users/me/data`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.message ?? `Deletion failed: ${res.status}`
        );
      }

      logout();
      router.push("/?deleted=true");
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : "Deletion failed. Please try again."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {showModal && (
        <DeleteConfirmationModal
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setShowModal(false);
            setDeleteError(null);
          }}
          isLoading={isDeleting}
          error={deleteError}
        />
      )}

      <main className="max-w-2xl mx-auto p-6 space-y-10">
        <h1 className="text-2xl font-bold text-gray-900">Data & Privacy</h1>

        {/* ── Export section ─────────────────────────────────────────────── */}
        <section aria-labelledby="export-heading" className="space-y-4">
          <h2
            id="export-heading"
            className="text-lg font-semibold text-gray-800"
          >
            Download my data
          </h2>
          <p className="text-sm text-gray-600">
            Download a copy of all personal data associated with your account in
            JSON format. This is rate-limited to once every 24 hours.
          </p>

          {exportError && (
            <p className="text-sm text-red-600" role="alert">
              {exportError}
            </p>
          )}

          {cooldownMs > 0 ? (
            <div className="flex items-center gap-3">
              <button
                disabled
                className="bg-gray-300 text-gray-500 px-4 py-2 rounded text-sm cursor-not-allowed"
                aria-disabled="true"
              >
                Download my data
              </button>
              <span className="text-sm text-gray-500">
                Available again in {formatCountdown(cooldownMs)}
              </span>
            </div>
          ) : (
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {isExporting ? (
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden="true"
                  />
                  Generating export…
                </span>
              ) : (
                "Download my data"
              )}
            </button>
          )}
        </section>

        <hr className="border-gray-200" />

        {/* ── Deletion section ───────────────────────────────────────────── */}
        <section aria-labelledby="deletion-heading" className="space-y-4">
          <h2
            id="deletion-heading"
            className="text-lg font-semibold text-red-700"
          >
            Delete my account
          </h2>

          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 space-y-2"
          >
            <p className="font-semibold">Warning — this cannot be undone</p>
            <ul className="list-disc list-inside space-y-1 text-red-700">
              <li>All uploaded documents will be permanently deleted</li>
              <li>All verification records will be removed</li>
              <li>Your profile and account credentials will be erased</li>
              <li>You will be logged out immediately</li>
            </ul>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Request account deletion
          </button>
        </section>
      </main>
    </>
  );
}