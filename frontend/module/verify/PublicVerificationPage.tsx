"use client";

import { useState } from "react";

interface VerificationResult {
  verified: boolean;
  transactionHash?: string;
  ledger?: number;
  anchoredAt?: string;
}

const HASH_PATTERN = /^[0-9a-f]{64}$/i;

export default function PublicVerificationPage() {
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim().toLowerCase();

    if (!HASH_PATTERN.test(trimmed)) {
      setInputError(
        "Please enter a valid 64-character hexadecimal hash (SHA-256)."
      );
      return;
    }

    setInputError(null);
    setLoading(true);
    setSubmitted(false);
    setResult(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/module/verify/${trimmed}`
      );
      const data = await res.json();
      setResult(data);
      setSubmitted(true);
    } catch {
      setInputError("Verification request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Document Hash Verification
        </h1>
        <p className="text-gray-600">
          Verify any document's integrity against the Stellar blockchain — no
          account required.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">What is document hash verification?</p>
        <p className="mt-1">
          A cryptographic hash is a unique fingerprint of a document's contents.
          SMALDA records this fingerprint on the Stellar blockchain at the time
          of submission. By verifying here, you can confirm that a document has
          not been altered since it was anchored — without seeing the original
          content.
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Document Hash (SHA-256)
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setInputError(null); }}
            placeholder="e.g. e3b0c44298fc1c149afbf4c8996fb924…"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
        </div>
        {inputError && (
          <p className="text-sm text-red-600">{inputError}</p>
        )}
      </form>

      {submitted && result && (
        <div
          className={`rounded-xl border p-6 ${
            result.verified
              ? "border-green-300 bg-green-50"
              : "border-red-300 bg-red-50"
          }`}
        >
          {result.verified ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-200">
                  <svg className="h-5 w-5 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-lg font-bold text-green-800">
                  Verified on Stellar
                </span>
              </div>
              <dl className="space-y-2 text-sm">
                {result.transactionHash && (
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-700 w-36">Transaction Hash</dt>
                    <dd className="break-all font-mono text-gray-800">
                      {result.transactionHash}
                    </dd>
                  </div>
                )}
                {result.ledger != null && (
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-700 w-36">Ledger</dt>
                    <dd className="text-gray-800">{result.ledger}</dd>
                  </div>
                )}
                {result.anchoredAt && (
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-700 w-36">Anchored At</dt>
                    <dd className="text-gray-800">
                      {new Date(result.anchoredAt).toLocaleString()}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-200">
                <svg className="h-5 w-5 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
              <div>
                <p className="font-bold text-red-800">Not Verified on Stellar</p>
                <p className="text-sm text-red-700">
                  No blockchain record was found for this hash.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
