"use client";

import React, { useState } from "react";
import { request } from "@/lib/api-client";
import { API_PREFIX } from "@/lib/api-contracts";
import {
  createDisputeSchema,
  disputeResponseSchema,
  DISPUTE_DESCRIPTION_UX_MIN_LENGTH,
  type DisputeResponse,
} from "@/lib/schemas/dispute";
import type { DocumentListItem } from "@/lib/schemas/document";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Document = Pick<DocumentListItem, "id" | "title">;

interface FileDisputeModalProps {
  documents: Document[];
  onDisputeFiled: (newDispute: DisputeResponse) => void;
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
  const availableDocuments = Array.isArray(documents) ? documents : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId) {
      setError("Please select a document.");
      return;
    }
    if (description.length < DISPUTE_DESCRIPTION_UX_MIN_LENGTH) {
      setError(
        `Description must be at least ${DISPUTE_DESCRIPTION_UX_MIN_LENGTH} characters long.`,
      );
      return;
    }
    const validation = createDisputeSchema.safeParse({
      documentId,
      description,
    });
    if (!validation.success) {
      setError("Please select a valid document.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const newDispute = disputeResponseSchema.parse(
        await request<unknown>(`${API_PREFIX}/disputes`, {
          method: "POST",
          body: validation.data,
        }),
      );
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
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>File a New Dispute</DialogTitle>
          <DialogDescription>
            Submit a dispute against one of your documents.
          </DialogDescription>
        </DialogHeader>
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
              {availableDocuments.map((doc) => (
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
              placeholder={`Please provide a detailed reason for your dispute (min. ${DISPUTE_DESCRIPTION_UX_MIN_LENGTH} characters).`}
            />
          </div>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </DialogClose>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Dispute"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
