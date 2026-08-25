"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types (match the backend DisputeResponseDto)
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
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const MOCK_DISPUTES: Dispute[] = [
  {
    id: "d1",
    documentId: "doc-123",
    description: "This document appears to be filed against a parcel I own.",
    reason: "ownership_conflict",
    filedBy: "me",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ documentId: "", description: "" });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/disputes`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Failed to load disputes (${res.status})`);
      const data = await res.json();
      setDisputes(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) {
      // Backend may not be running yet — fall back to mock data so the UI
      // remains usable during development.
      setDisputes(MOCK_DISPUTES);
      setError(
        err instanceof Error
          ? `${err.message} — showing sample data`
          : "Showing sample data",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  async function handleFileDispute(e: React.FormEvent) {
    e.preventDefault();
    if (!form.documentId.trim() || !form.description.trim()) {
      setFormError("Document ID and description are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`${API_BASE}/api/disputes`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`Failed to file dispute (${res.status})`);
      setForm({ documentId: "", description: "" });
      setShowForm(false);
      await fetchDisputes();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to file dispute.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Disputes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Disputes you have filed against documents.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {showForm ? "Cancel" : "File a new dispute"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleFileDispute}
          className="mb-6 space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-gray-900">
            File a new dispute
          </h2>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="documentId"
              className="text-sm font-medium text-gray-700"
            >
              Document ID
            </label>
            <input
              id="documentId"
              name="documentId"
              value={form.documentId}
              onChange={(e) =>
                setForm((f) => ({ ...f, documentId: e.target.value }))
              }
              placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="description"
              className="text-sm font-medium text-gray-700"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={4}
              placeholder="Explain why you are disputing this document…"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit dispute"}
          </button>
        </form>
      )}

      {error && (
        <p role="status" className="mb-4 text-xs text-gray-500">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500" role="status">
          Loading disputes…
        </p>
      ) : disputes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <h3 className="text-sm font-semibold text-gray-900">
            No disputes filed
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            When you file a dispute it will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-medium text-gray-600"
                >
                  Document
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-medium text-gray-600"
                >
                  Reason
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-medium text-gray-600"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left font-medium text-gray-600"
                >
                  Filed
                </th>
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {disputes.map((dispute) => (
                <tr key={dispute.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {dispute.documentId}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {dispute.reason ?? "General"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                      Open
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(dispute.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/disputes/${dispute.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
