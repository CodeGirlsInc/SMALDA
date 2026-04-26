"use client";

import React, { useState } from "react";
import { UploadCloud, FileText, CheckCircle2, XCircle } from "lucide-react";
import AppShell from "../../responsive/AppShell";
import { FileUpload } from "../../components/FileUpload";

export default function UploadPage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile || !documentTitle.trim()) return;

    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    setSubmitStatus("success");

    // Reset after a delay
    setTimeout(() => {
      setUploadedFile(null);
      setDocumentTitle("");
      setSubmitStatus("idle");
    }, 3000);
  };

  return (
    <AppShell userName="John Kamau" userInitials="JK">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Upload Document
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a land document for risk analysis and Stellar blockchain
            verification.
          </p>

          {submitStatus === "success" ? (
            <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-400" />
              <h2 className="mt-4 text-lg font-semibold text-emerald-800 dark:text-emerald-300">
                Document uploaded successfully!
              </h2>
              <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
                Your document is now being analyzed. Check the Documents page
                for updates.
              </p>
              <a
                href="/documents"
                className="mt-4 inline-flex min-h-[44px] items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                View Documents
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              {/* Document Title */}
              <div>
                <label
                  htmlFor="document-title"
                  className="block text-sm font-medium text-foreground"
                >
                  Document Title
                </label>
                <input
                  type="text"
                  id="document-title"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder="e.g. Land Deed - Plot 42A Nairobi"
                  className="mt-1 block w-full min-h-[44px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Document File
                </label>
                <FileUpload
                  allowedMimeTypes={[
                    "application/pdf",
                    "image/png",
                    "image/jpeg",
                  ]}
                  maxFileSizeBytes={10 * 1024 * 1024} // 10MB
                  onFileSelect={setUploadedFile}
                  label="Drag and drop your document here, or click to browse"
                />
              </div>

              {/* Supported formats info */}
              <div className="rounded-md bg-muted p-4">
                <h3 className="text-sm font-medium text-foreground">
                  Supported Formats
                </h3>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    PDF documents (up to 10MB)
                  </li>
                  <li className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    PNG images (up to 10MB)
                  </li>
                  <li className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    JPEG images (up to 10MB)
                  </li>
                </ul>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={!uploadedFile || !documentTitle.trim() || isSubmitting}
                className="flex w-full items-center justify-center min-h-[44px] rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="mr-2 h-4 w-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Upload & Analyze Document
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </AppShell>
  );
}
