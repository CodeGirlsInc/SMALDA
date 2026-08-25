"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VerificationResult {
  verified: boolean;
  message?: string;
  stellarTxHash?: string;
  stellarLedger?: number;
  anchoredAt?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const STELLAR_EXPLORER = "https://stellar.expert/explorer/testnet/tx";

const HASH_REGEX = /^[a-fA-F0-9]{64}$/;

/** Simple client-side SHA-256 hash validation (64 hex chars). */
function isMalformedHash(hash: string): boolean {
  return !HASH_REGEX.test(hash.trim());
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PublicVerifyPage() {
  const params = useParams<{ hash: string }>();
  const hash = params.hash;

  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const verify = useCallback(async () => {
    if (!hash) return;
    const trimmed = hash.trim();

    // Reject malformed hashes client-side before hitting the API.
    if (isMalformedHash(trimmed)) {
      setInvalid(true);
      setLoading(false);
      return;
    }
    setInvalid(false);
    setLoading(true);
    setError(null);

    try {
      // Public endpoint — no authentication required (BE-107).
      const res = await fetch(`${API_BASE}/api/verify/${trimmed}`);
      if (!res.ok) throw new Error(`Verification failed (${res.status})`);
      const data: VerificationResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Verification service unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }, [hash]);

  useEffect(() => {
    verify();
  }, [verify]);

  const shareableUrl =
    typeof window !== "undefined" ? window.location.href : "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — ignore
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Document verification</h1>
        <p className="mt-2 text-sm text-gray-500">
          Check whether a document has been recorded on the Stellar blockchain.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {/* Malformed hash — client-side message before hitting the API */}
        {invalid && (
          <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            <p className="font-medium">Invalid hash format</p>
            <p className="mt-1">
              A document hash must be a 64-character hexadecimal SHA-256 value
              (characters 0-9 and a-f).
            </p>
          </div>
        )}

        {loading && (
          <p role="status" aria-live="polite" className="text-sm text-gray-500">
            Checking the Stellar ledger…
          </p>
        )}

        {error && !invalid && (
          <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <button
              onClick={verify}
              className="mt-2 text-sm font-medium text-red-700 underline"
            >
              Retry
            </button>
          </div>
        )}

        {result && !invalid && !error && (
          <div>
            {result.verified ? (
              <div className="text-center">
                <span
                  aria-hidden="true"
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600"
                >
                  <svg
                    className="h-8 w-8"
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
                <h2 className="mt-3 text-lg font-bold text-green-700">
                  Verified on Stellar
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  This document hash has a confirmed record on the Stellar
                  blockchain.
                </p>

                <dl className="mt-6 space-y-3 text-left">
                  {result.stellarTxHash && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500">
                        Stellar transaction hash
                      </dt>
                      <dd>
                        <a
                          href={`${STELLAR_EXPLORER}/${result.stellarTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-sm text-blue-600 underline break-all hover:text-blue-800"
                        >
                          {result.stellarTxHash}
                        </a>
                      </dd>
                    </div>
                  )}
                  {result.stellarLedger != null && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500">Ledger</dt>
                      <dd className="text-sm text-gray-800">
                        #{result.stellarLedger}
                      </dd>
                    </div>
                  )}
                  {result.anchoredAt && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500">
                        Anchored at
                      </dt>
                      <dd className="text-sm text-gray-800">
                        {new Date(result.anchoredAt).toLocaleString()}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            ) : (
              <div className="text-center">
                <span
                  aria-hidden="true"
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                >
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </span>
                <h2 className="mt-3 text-lg font-bold text-gray-700">
                  Not verified
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {result.message ??
                    "No on-chain record was found for this document hash."}
                </p>
              </div>
            )}

            {/* Copyable / shareable URL */}
            <div className="mt-6 border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500">
                Share this verification
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  readOnly
                  value={shareableUrl}
                  aria-label="Shareable verification URL"
                  className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700"
                />
                <button
                  onClick={handleCopy}
                  className="shrink-0 rounded-lg bg-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-300"
                >
                  {copied ? "✓" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Plain-language explanation for non-technical visitors */}
      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-5">
        <h3 className="text-sm font-semibold text-blue-800">
          What does &ldquo;verified on Stellar&rdquo; mean?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-blue-700">
          When a document is verified, a cryptographic fingerprint (hash) of it
          was permanently written to the Stellar blockchain — a public,
          tamper-proof ledger that anyone can inspect. This lets a third party,
          such as a bank officer or buyer, independently confirm that the
          document&rsquo;s contents have not been altered since it was
          registered.
        </p>
      </div>
    </main>
  );
}
