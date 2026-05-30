"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { UploadCloud, FileText, X } from "lucide-react";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface UploadResult {
  id: string;
  duplicate: boolean;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function validateAndSet(f: File) {
    setFileError(null);
    setResult(null);
    setUploadError(null);
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setFileError("Only PDF, PNG, and JPEG files are accepted.");
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      setFileError(`File exceeds the ${MAX_SIZE_MB} MB limit.`);
      return;
    }
    setFile(f);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSet(f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploadError(null);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${process.env.NEXT_PUBLIC_API_URL}/api/documents/upload`);
      xhr.setRequestHeader(
        "Authorization",
        `Bearer ${localStorage.getItem("access_token")}`
      );
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = () => {
        setProgress(null);
        if (xhr.status === 202) {
          const data = JSON.parse(xhr.responseText);
          setResult({ id: data.id, duplicate: false });
          setFile(null);
        } else if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          setResult({ id: data.id, duplicate: true });
          setFile(null);
        } else {
          setUploadError("Upload failed. Please try again.");
        }
        resolve();
      };
      xhr.onerror = () => {
        setProgress(null);
        setUploadError("Network error. Please try again.");
        resolve();
      };
      xhr.send(formData);
    });
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Upload Document</h1>

      {result ? (
        <div className={`rounded-xl border p-5 ${result.duplicate ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50"}`}>
          {result.duplicate ? (
            <>
              <p className="text-sm font-medium text-yellow-800">
                This document already exists.
              </p>
              <Link
                href={`/documents/${result.id}`}
                className="mt-2 inline-block text-sm text-yellow-700 underline"
              >
                View existing record
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-green-800">
                Document uploaded successfully.
              </p>
              <Link
                href={`/documents/${result.id}`}
                className="mt-2 inline-block text-sm text-green-700 underline"
              >
                View document
              </Link>
            </>
          )}
          <button
            onClick={() => setResult(null)}
            className="mt-3 block text-xs text-gray-500 underline"
          >
            Upload another
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            aria-label="Drop zone: click or drag a file here"
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors ${
              dragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
            }`}
          >
            <UploadCloud className="h-10 w-10 text-gray-400" aria-hidden="true" />
            <p className="text-sm text-gray-600">
              Drag & drop or <span className="font-semibold text-blue-600">browse</span>
            </p>
            <p className="text-xs text-gray-400">PDF, PNG, JPEG â€” max {MAX_SIZE_MB} MB</p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) validateAndSet(f); }}
            />
          </div>

          {fileError && (
            <p role="alert" className="text-sm text-red-600">{fileError}</p>
          )}

          {/* File preview */}
          {file && (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-400" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatBytes(file.size)} Â· {file.type}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                aria-label="Remove file"
                className="rounded p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Progress */}
          {progress !== null && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-gray-500">
                <span>Uploadingâ€¦</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {uploadError && (
            <p role="alert" className="text-sm text-red-600">{uploadError}</p>
          )}

          <button
            type="submit"
            disabled={!file || progress !== null}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {progress !== null ? "Uploadingâ€¦" : "Upload"}
          </button>
        </form>
      )}
    </div>
  );
}
