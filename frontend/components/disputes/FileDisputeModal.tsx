"use client";

import React, { useState } from "react";
import { request } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";

interface Document {
  id: string;
  title: string;
}

interface FileDisputeModalProps {
  documents: Document[];
  onDisputeFiled: (newDispute: any) => void;
  onClose: () => void;
}

export function FileDisputeModal({
  documents,
  onDisputeFiled,
  onClose,
}: FileDisputeModalProps) {
  const [documentId, setDocumentId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId) {
      setError("Please select a document.");
      return;
    }
    if (description.length < 20) {
      setError("Description must be at least 20 characters long.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const newDispute = await request("/api/disputes", {
        method: "POST",
        body: { documentId, description },
      });
      onDisputeFiled(newDispute);
      toast({
        title: "Dispute Filed",
        description: "Your dispute has been successfully filed.",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to file dispute.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">
          File a New Dispute
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="document"
              className="block text-sm font-medium text-gray-700"
            >
              Select Document
            </label>
            <select
              id="document"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select a document</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700"
            >
              Reason for Dispute
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Please provide a detailed reason for your dispute (min. 20 characters)."
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Dispute"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
