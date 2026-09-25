"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { request } from "@/lib/api-client";
import { FileDisputeModal, type FiledDispute } from "@/components/disputes/FileDisputeModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DisputeStatus = "open" | "in_review" | "resolved" | "dismissed";

type Dispute = FiledDispute;

interface Document {
  id: string;
  title: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CLASSES: Record<DisputeStatus, string> = {
  open: "bg-blue-100 text-blue-800",
  in_review: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  dismissed: "bg-red-100 text-red-800",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | "all">(
    "all",
  );
  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await request<{ data: Dispute[]; total: number }>(
        "/disputes",
      );
      setDisputes(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load disputes.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await request<{
        data: Document[];
        total: number;
        page: number;
        limit: number;
      }>("/documents");
      setDocuments(response.data);
    } catch {
      setDocuments([]);
    }
  }, []);

  useEffect(() => {
    fetchDisputes();
    fetchDocuments();
  }, [fetchDisputes, fetchDocuments]);

  const handleDisputeFiled = (newDispute: Dispute) => {
    setDisputes((prevDisputes) => [newDispute, ...prevDisputes]);
  };

  const filteredDisputes =
    statusFilter === "all"
      ? disputes
      : disputes.filter((d) => d.status === statusFilter);

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
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          File a new dispute
        </button>
      </div>

      {showModal && (
        <FileDisputeModal
          documents={documents}
          onDisputeFiled={handleDisputeFiled}
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="mb-4">
        <label htmlFor="status-filter" className="sr-only">
          Filter by status
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as DisputeStatus | "all")
          }
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_review">In Review</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      {error && (
        <p role="status" className="mb-4 text-xs text-red-500">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500" role="status">
          Loading disputes…
        </p>
      ) : filteredDisputes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <h3 className="text-sm font-semibold text-gray-900">
            No disputes filed
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {statusFilter === "all"
              ? "When you file a dispute it will appear here."
              : `You have no disputes with the status '${statusFilter}'.`}
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
              {filteredDisputes.map((dispute) => (
                <tr key={dispute.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {documents.find((d) => d.id === dispute.documentId)
                      ?.title ?? dispute.documentId}
                  </td>
                  <td
                    className="px-4 py-3 text-gray-700 truncate"
                    style={{ maxWidth: "200px" }}
                  >
                    {dispute.description}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_CLASSES[dispute.status]
                      }`}
                    >
                      {dispute.status.replace("_", " ")}
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
