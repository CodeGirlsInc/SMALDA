"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export default function DocumentUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Invalid file type. Only PDF, PNG, and JPEG files are allowed.";
    }
    if (file.size > MAX_SIZE_BYTES) {
      return "File is too large. Maximum file size allowed is 20MB.";
    }
    return null;
  }

  function handleFileChange(file: File | null) {
    if (!file) return;
    const valError = validateFile(file);
    if (valError) {
      setError(valError);
      setSelectedFile(null);
      return;
    }

    setError("");
    setSelectedFile(file);
    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please select a valid document file.");
      return;
    }

    const valError = validateFile(selectedFile);
    if (valError) {
      setError(valError);
      return;
    }

    setUploading(true);
    setProgress(10);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", title || selectedFile.name);

      // Simulated upload progress
      const interval = setInterval(() => {
        setProgress((prev) => (prev >= 90 ? prev : prev + 20));
      }, 200);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(interval);
      setProgress(100);

      if (response.status === 202 || response.ok) {
        const data = await response.json().catch(() => ({ id: "new-doc-id" }));
        const docId = data.id || data.documentId || "new-doc-id";
        setTimeout(() => {
          router.push(`/documents/${docId}`);
        }, 500);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.message || "Failed to upload document. Please try again.");
      }
    } catch {
      setError("Network error uploading document.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-white">
      <div className="rounded-xl border border-gray-800 bg-gray-950 p-8 shadow-2xl">
        <h1 className="text-2xl font-bold">Upload New Document</h1>
        <p className="mt-1 text-xs text-gray-400">
          Upload PDF, PNG, or JPEG documents (up to 20MB) for automated AI verification.
        </p>

        <form onSubmit={handleUpload} className="mt-6">
          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-300">Document Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q2 Financial Report"
              className="mt-2 w-full rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`my-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition cursor-pointer ${
              isDragOver
                ? "border-blue-500 bg-blue-500/10"
                : selectedFile
                ? "border-green-500/50 bg-green-500/5"
                : "border-gray-800 bg-gray-900/50 hover:border-gray-700"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpeg,.jpg"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />

            {selectedFile ? (
              <div>
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-green-400">
                  📄
                </div>
                <p className="text-sm font-semibold text-green-400">{selectedFile.name}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click to change file
                </p>
              </div>
            ) : (
              <div>
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 text-gray-400">
                  ⬆
                </div>
                <p className="text-sm font-medium text-gray-200">
                  Drag and drop your file here, or <span className="text-blue-400 underline">browse</span>
                </p>
                <p className="mt-1 text-xs text-gray-500">Supports PDF, PNG, JPEG (Max 20MB)</p>
              </div>
            )}
          </div>

          {error && <p className="mb-4 text-xs text-red-400">{error}</p>}

          {uploading && (
            <div className="mb-6">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Uploading document...</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full bg-blue-500 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.push("/documents")}
              className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow hover:bg-blue-500 disabled:opacity-40"
            >
              {uploading ? "Uploading..." : "Upload Document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
