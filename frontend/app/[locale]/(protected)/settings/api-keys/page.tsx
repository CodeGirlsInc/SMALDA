"use client";

import React, { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiKey {
  id: string;
  name: string;
  prefix: string; // e.g. "sk_live_abc1..."
  createdAt: string;
  lastUsedAt: string | null;
  status: "active" | "revoked";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Cross-browser clipboard copy with execCommand fallback. */
async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for browsers without Clipboard API
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

// ---------------------------------------------------------------------------
// Generate modal
// ---------------------------------------------------------------------------

interface GenerateModalProps {
  onGenerate: (name: string) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
}

function GenerateModal({ onGenerate, onClose, isLoading, error }: GenerateModalProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="generate-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-6 space-y-4">
        <h2 id="generate-modal-title" className="text-lg font-semibold text-gray-900">
          Generate new API key
        </h2>
        <div>
          <label htmlFor="key-name" className="block text-sm font-medium text-gray-700 mb-1">
            Key name
          </label>
          <input
            id="key-name"
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Production integration"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="off"
          />
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={() => onGenerate(name.trim())}
            disabled={!name.trim() || isLoading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {isLoading ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New key reveal panel (shown once, then dismissed)
// ---------------------------------------------------------------------------

interface NewKeyRevealProps {
  keyValue: string;
  onDismiss: () => void;
}

function NewKeyReveal({ keyValue, onDismiss }: NewKeyRevealProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await copyToClipboard(keyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      role="alert"
      className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 space-y-3"
    >
      <p className="text-sm font-semibold text-yellow-800">
        ⚠ Copy your API key now — it will not be shown again.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={keyValue}
          aria-label="New API key"
          className="flex-1 rounded border border-yellow-200 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button
          onClick={handleCopy}
          className="shrink-0 px-3 py-2 text-sm rounded bg-yellow-600 text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          aria-label="Copy API key"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <button
        onClick={onDismiss}
        className="text-sm text-yellow-700 underline hover:text-yellow-900 focus:outline-none"
      >
        I have copied my key — dismiss
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revoke confirmation dialog
// ---------------------------------------------------------------------------

interface RevokeDialogProps {
  keyName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function RevokeDialog({ keyName, onConfirm, onCancel, isLoading }: RevokeDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revoke-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-sm bg-white rounded-lg shadow-xl p-6 space-y-4">
        <h2 id="revoke-dialog-title" className="text-lg font-semibold text-gray-900">
          Revoke API key
        </h2>
        <p className="text-sm text-gray-600">
          Are you sure you want to revoke <strong>{keyName}</strong>? Any
          integrations using this key will stop working immediately.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {isLoading ? "Revoking…" : "Revoke key"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Generate modal
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Newly created key — shown once
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);

  // Revoke dialog
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  // ── Load keys ─────────────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchKeys() {
      try {
        const res = await fetch(`${API_BASE}/api/users/me/api-keys`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error(`Failed to load keys: ${res.status}`);
        const json = await res.json();
        setKeys(json.data ?? []);
      } catch (err: unknown) {
        setLoadError(err instanceof Error ? err.message : "Failed to load API keys");
      } finally {
        setLoading(false);
      }
    }
    fetchKeys();
  }, []);

  // ── Generate ───────────────────────────────────────────────────────────────

  async function handleGenerate(name: string) {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch(`${API_BASE}/api/users/me/api-keys`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `Request failed: ${res.status}`);
      }
      const json = await res.json();
      // The full key is only returned on creation
      setNewKeyValue(json.data?.key ?? "");
      // Add the redacted entry to the table
      setKeys((prev) => [json.data?.record ?? { ...json.data, status: "active" }, ...prev]);
      setShowGenerate(false);
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : "Failed to generate key");
    } finally {
      setGenerating(false);
    }
  }

  // ── Revoke ─────────────────────────────────────────────────────────────────

  async function handleRevokeConfirm() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/users/me/api-keys/${revokeTarget.id}`,
        { method: "DELETE", headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error(`Revoke failed: ${res.status}`);
      setKeys((prev) =>
        prev.map((k) =>
          k.id === revokeTarget.id ? { ...k, status: "revoked" as const } : k
        )
      );
    } catch {
      // silently leave key as-is; real app would show toast
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {showGenerate && (
        <GenerateModal
          onGenerate={handleGenerate}
          onClose={() => setShowGenerate(false)}
          isLoading={generating}
          error={generateError}
        />
      )}

      {revokeTarget && (
        <RevokeDialog
          keyName={revokeTarget.name}
          onConfirm={handleRevokeConfirm}
          onCancel={() => setRevokeTarget(null)}
          isLoading={revoking}
        />
      )}

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage programmatic access to SMALDA. Treat API keys like
              passwords — never share them publicly.
            </p>
          </div>
          <button
            onClick={() => { setShowGenerate(true); setGenerateError(null); }}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Generate new key
          </button>
        </div>

        {/* Newly generated key — shown once */}
        {newKeyValue && (
          <NewKeyReveal
            keyValue={newKeyValue}
            onDismiss={() => setNewKeyValue(null)}
          />
        )}

        {/* Loading / error states */}
        {loading && (
          <p className="text-sm text-gray-500" role="status">
            Loading API keys…
          </p>
        )}
        {loadError && (
          <p className="text-sm text-red-600" role="alert">
            {loadError}
          </p>
        )}

        {/* Empty state */}
        {!loading && !loadError && keys.length === 0 && (
          <div className="text-center py-16 border border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-500 font-medium">No API keys yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Generate your first key to get started.
            </p>
          </div>
        )}

        {/* Keys table */}
        {!loading && keys.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-gray-600">Key</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-gray-600">Last used</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{key.name}</td>
                    <td className="px-4 py-3 font-mono text-gray-600 text-xs">{key.prefix}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      {key.status === "active" ? (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
                          Revoked
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {key.status === "active" && (
                        <button
                          onClick={() => setRevokeTarget(key)}
                          className="text-xs text-red-600 hover:text-red-800 underline focus:outline-none focus:ring-1 focus:ring-red-500 rounded"
                          aria-label={`Revoke key ${key.name}`}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}