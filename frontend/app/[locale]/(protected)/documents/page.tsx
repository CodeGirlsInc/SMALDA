"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface DocumentItem {
  id: string;
  title: string;
  filename: string;
  status: "PENDING" | "ANALYZING" | "VERIFIED" | "FLAGGED" | "REJECTED";
  createdAt: string;
  fileSize: string;
}

const STATUS_BADGE_CLASSES: Record<DocumentItem["status"], string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  ANALYZING: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  VERIFIED: "bg-green-500/10 text-green-400 border-green-500/30",
  FLAGGED: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  REJECTED: "bg-red-500/10 text-red-400 border-red-500/30",
};

export default function DocumentsListPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5;

  useEffect(() => {
    async function fetchDocuments() {
      setLoading(true);
      try {
        const res = await fetch("/api/documents");
        if (res.ok) {
          const data = await res.json();
          setDocuments(data.documents || []);
        } else {
          // Fallback mock dataset for demonstration if API endpoint is unpopulated
          setDocuments([
            { id: "doc-1", title: "Financial Statement Q2", filename: "financial_q2.pdf", status: "VERIFIED", createdAt: "2026-07-28", fileSize: "1.2 MB" },
            { id: "doc-2", title: "Identity Verification Document", filename: "passport_scan.png", status: "ANALYZING", createdAt: "2026-07-29", fileSize: "3.4 MB" },
            { id: "doc-3", title: "Tax Exemption Form", filename: "tax_form_2025.pdf", status: "PENDING", createdAt: "2026-07-29", fileSize: "850 KB" },
            { id: "doc-4", title: "Compliance Report 2025", filename: "compliance_2025.pdf", status: "FLAGGED", createdAt: "2026-07-27", fileSize: "4.1 MB" },
            { id: "doc-5", title: "Outdated License Copy", filename: "old_license.jpeg", status: "REJECTED", createdAt: "2026-07-25", fileSize: "2.0 MB" },
          ]);
        }
      } catch {
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    }
    fetchDocuments();
  }, []);

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage) || 1;
  const paginatedDocuments = filteredDocuments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-white">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Document Management</h1>
          <p className="text-xs text-gray-400">View, search, and manage your verified documents.</p>
        </div>
        <Link
          href="/documents/upload"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-500"
        >
          + Upload New Document
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-gray-800 bg-gray-950 p-4 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          placeholder="Search documents by title..."
          className="w-full rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none sm:w-72"
        />

        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="ANALYZING">ANALYZING</option>
            <option value="VERIFIED">VERIFIED</option>
            <option value="FLAGGED">FLAGGED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>
      </div>

      {/* Documents Table */}
      <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950 shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <p className="mt-3 text-xs text-gray-400">Loading document list...</p>
          </div>
        ) : paginatedDocuments.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">
            No documents found matching your filter criteria.
          </div>
        ) : (
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="border-b border-gray-800 bg-gray-900 text-xs font-semibold text-gray-400">
              <tr>
                <th className="px-6 py-3.5">Title</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">File Size</th>
                <th className="px-6 py-3.5">Uploaded Date</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {paginatedDocuments.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-900/50">
                  <td className="px-6 py-4 font-medium text-white">
                    <Link href={`/documents/${doc.id}`} className="hover:underline">
                      {doc.title}
                    </Link>
                    <div className="text-xs font-mono text-gray-500">{doc.filename}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        STATUS_BADGE_CLASSES[doc.status]
                      }`}
                    >
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-400">{doc.fileSize}</td>
                  <td className="px-6 py-4 text-xs text-gray-400">{doc.createdAt}</td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="text-xs font-medium text-blue-400 hover:text-blue-300"
                    >
                      View Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-gray-800 px-6 py-4">
          <span className="text-xs text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex space-x-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="rounded-md border border-gray-800 bg-gray-900 px-3 py-1 text-xs text-gray-300 hover:bg-gray-800 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="rounded-md border border-gray-800 bg-gray-900 px-3 py-1 text-xs text-gray-300 hover:bg-gray-800 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
