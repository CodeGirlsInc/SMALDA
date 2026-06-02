"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Document {
  id: string;
  title: string;
}

interface DisputeSubmissionFormProps {
  documentId?: string;
}

const DISPUTE_TYPES = [
  "OWNERSHIP",
  "AUTHENTICITY",
  "CONTENT",
  "DUPLICATE",
  "OTHER",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export default function DisputeSubmissionForm({
  documentId,
}: DisputeSubmissionFormProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState(documentId ?? "");
  const [disputeType, setDisputeType] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const token = () => localStorage.getItem("access_token") ?? "";

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/module/documents`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then((r) => r.json())
      .then((data) => setDocuments(data.data ?? data))
      .catch(() => {});
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFileError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(f.type)) {
      setFileError("Only PDF, PNG, and JPEG files are allowed.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setFileError("File must be smaller than 10 MB.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setFile(f);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!selectedDocId) errs.document = "Please select a document.";
    if (!disputeType) errs.disputeType = "Please select a dispute type.";
    if (!description.trim()) {
      errs.description = "Description is required.";
    } else if (description.trim().length < 20) {
      errs.description = "Description must be at least 20 characters.";
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      let evidenceKey: string | null = null;

      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const uploadRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/module/disputes/evidence`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token()}` },
            body: fd,
          }
        );
        if (!uploadRes.ok) throw new Error("Evidence upload failed.");
        const uploadData = await uploadRes.json();
        evidenceKey = uploadData.key ?? null;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/module/disputes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token()}`,
          },
          body: JSON.stringify({
            documentId: selectedDocId,
            disputeType,
            description: description.trim(),
            ...(evidenceKey ? { evidenceKey } : {}),
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "Submission failed.");
      }

      router.push("/disputes?submitted=1");
    } catch (err) {
      setErrors({
        form: err instanceof Error ? err.message : "Unexpected error.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Submit a Dispute</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {errors.form && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {errors.form}
          </p>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Document
          </label>
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a document…</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          {errors.document && (
            <p className="mt-1 text-xs text-red-600">{errors.document}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Dispute Type
          </label>
          <select
            value={disputeType}
            onChange={(e) => setDisputeType(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select type…</option>
            {DISPUTE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {errors.disputeType && (
            <p className="mt-1 text-xs text-red-600">{errors.disputeType}</p>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Description
            </label>
            <span className="text-xs text-gray-400">
              {description.length} chars (min 20)
            </span>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Describe the dispute in detail…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-600">{errors.description}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Evidence (optional — PDF / PNG / JPEG, max 10 MB)
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            className="text-sm text-gray-600"
          />
          {fileError && (
            <p className="mt-1 text-xs text-red-600">{fileError}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Dispute"}
        </button>
      </form>
    </div>
  );
}
