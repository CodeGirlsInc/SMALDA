"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Dispute {
  id: string;
  documentId: string;
  description: string;
  reason: string | null;
  filedBy: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const MOCK_DISPUTE: Dispute = {
  id: "d1",
  documentId: "doc-123",
  description: "This document appears to be filed against a parcel I own.",
  reason: "ownership_conflict",
  filedBy: "me",
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const disputeId = params.id;

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!disputeId) return;
    fetch(`${API_BASE}/api/disputes/${disputeId}`, {
      headers: getAuthHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load dispute (${res.status})`);
        return res.json() as Promise<Dispute>;
      })
      .then(setDispute)
      .catch((err) => {
        // Fall back to sample data when the backend is unavailable.
        setDispute(MOCK_DISPUTE);
        setError(
          err instanceof Error
            ? `${err.message} — showing sample data`
            : "Showing sample data",
        );
      })
      .finally(() => setLoading(false));
  }, [disputeId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8" aria-busy="true">
        <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-gray-200" />
      </main>
    );
  }

  if (!dispute) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-sm text-red-600">{error ?? "Dispute not found."}</p>
        <Link href="/disputes" className="mt-3 block text-sm text-blue-600 underline">
          Back to disputes
        </Link>
      </main>
    );
  }

  const filedAt = new Date(dispute.createdAt);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/disputes"
        className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700"
      >
        ← Back to disputes
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">Dispute details</h1>

      {error && (
        <p role="status" className="mt-2 text-xs text-gray-500">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            Classified reason
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            {dispute.reason ?? "General dispute"}
          </p>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Description</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-gray-700">
            {dispute.description}
          </p>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            Status timeline
          </h2>
          <ol className="mt-4 space-y-4">
            {[
              {
                label: "Filed",
                date: filedAt,
                done: true,
              },
              {
                label: "Under review",
                date: null,
                done: false,
              },
              {
                label: "Resolved",
                date: null,
                done: false,
              },
            ].map((step) => (
              <li key={step.label} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                    step.done ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {step.label}
                  </p>
                  <p className="text-xs text-gray-500">
                    {step.date ? step.date.toLocaleString() : "Pending"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Reference</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Dispute ID</dt>
              <dd className="font-mono text-gray-800">{dispute.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Document ID</dt>
              <dd className="font-mono text-gray-800">{dispute.documentId}</dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}
