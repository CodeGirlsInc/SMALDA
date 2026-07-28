"use client";

import Link from "next/link";

/**
 * Scoped not-found for the document detail route. Distinct from a
 * verification failure: a missing hash means no record was ever
 * anchored, not that the verifier adjudicated and rejected it.
 *
 * This file is intentionally outside the [locale] boundary so the
 * English-only copy is rendered consistently regardless of locale
 * (the document ID itself is locale-invariant).
 */
export default function DocumentNotFound() {
  return (
    <div
      className="mx-auto max-w-2xl p-6 text-center"
      data-testid="document-not-found"
    >
      <h2 className="text-2xl font-bold text-gray-900">No record anchored</h2>
      <p className="mt-3 text-sm text-gray-600">
        This document hash has no record anchored on the Stellar ledger.
      </p>
      <p className="mt-2 text-sm text-gray-600">
        This is different from a verification failure. A failed verification
        means a record exists but did not match what you submitted; an
        unanchored hash means no party has ever published this hash, so
        there is nothing to verify against.
      </p>
      <p className="mt-4 text-xs text-gray-500">
        This is a 404 (record not found), not a 422 or 500. The verifier
        did not adjudicate.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-sm font-medium text-blue-600 underline hover:text-blue-800"
      >
        Back to home
      </Link>
    </div>
  );
}
