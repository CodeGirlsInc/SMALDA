"use client";

import {
  useState,
  useRef,
  useCallback,
  DragEvent,
  ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

type UploadState =
  | { stage: "idle" }
  | { stage: "selected"; file: File }
  | { stage: "uploading"; file: File; progress: number }
  | { stage: "error"; file: File; message: string }
  | { stage: "done"; documentId: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileTypeLabel(type: string): string {
  if (type === "application/pdf") return "PDF";
  if (type === "image/png") return "PNG";
  if (type === "image/jpeg") return "JPEG";
  return type.split("/")[1]?.toUpperCase() ?? "File";
}

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `Only PDF, PNG, and JPEG files are accepted. You uploaded a ${file.type || "unknown"} file.`;
  }
  if (file.size > MAX_BYTES) {
    return `File is too large (${formatBytes(file.size)}). Maximum allowed size is 20 MB.`;
  }
  return null;
}

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<UploadState>({ stage: "idle" });
  const [dragging, setDragging] = useState(false);
  const [validationError, setValidationError] = useState("");

  // ── File selection ─────────────────────────────────────────────────────────
  const selectFile = useCallback((file: File) => {
    const err = validateFile(file);
    if (err) {
      setValidationError(err);
      setState({ stage: "idle" });
      return;
    }
    setValidationError("");
    setState({ stage: "selected", file });
  }, []);

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) selectFile(file);
    // Reset so the same file can be re-selected after clearing
    e.target.value = "";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) selectFile(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function clearFile() {
    setState({ stage: "idle" });
    setValidationError("");
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (state.stage !== "selected") return;
    const { file } = state;

    setState({ stage: "uploading", file, progress: 0 });

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Use XMLHttpRequest so we get real upload progress events
      const documentId = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (ev) => {
          if (ev.lengthComputable) {
            const pct = Math.round((ev.loaded / ev.total) * 100);
            setState({ stage: "uploading", file, progress: pct });
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data.id ?? data.documentId ?? "unknown");
            } catch {
              reject(new Error("Unexpected response from server."));
            }
          } else {
            let message = "Upload failed. Please try again.";
            try {
              const data = JSON.parse(xhr.responseText);
              if (data.message) message = data.message;
            } catch {
              // ignore
            }
            reject(new Error(message));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Network error. Check your connection and try again."));
        });

        xhr.open("POST", "/api/documents/upload");
        xhr.send(formData);
      });

      setState({ stage: "done", documentId });
      // Short delay so the user sees 100% before redirect
      setTimeout(() => router.push(`/documents/${documentId}`), 800);
    } catch (err: unknown) {
      setState({
        stage: "error",
        file,
        message: err instanceof Error ? err.message : "Upload failed.",
      });
    }
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const selectedFile =
    state.stage === "selected" ||
    state.stage === "uploading" ||
    state.stage === "error"
      ? state.file
      : null;

  const progress =
    state.stage === "uploading"
      ? state.progress
      : state.stage === "done"
      ? 100
      : 0;

  const isUploading = state.stage === "uploading";
  const isDone = state.stage === "done";

  return (
    <main className="min-h-screen bg-[#F5F3EE] px-4 py-12">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors mb-6"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to dashboard
          </a>

          <span className="block text-[11px] font-semibold tracking-[0.2em] text-stone-400 uppercase mb-2">
            Document verification
          </span>
          <h1
            className="text-3xl font-bold text-stone-900"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            Upload document
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Upload a land ownership document for AI-powered risk analysis.
            Accepted formats: PDF, PNG, JPEG &mdash; up to 20 MB.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-7">

          {/* Validation error */}
          {validationError && (
            <div
              role="alert"
              className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {validationError}
            </div>
          )}

          {/* Upload error */}
          {state.stage === "error" && (
            <div
              role="alert"
              className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {state.message}
            </div>
          )}

          {/* Drop zone — hidden while a file is selected */}
          {!selectedFile && (
            <div
              role="button"
              tabIndex={0}
              aria-label="Drop a file here or click to browse"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed
                px-6 py-14 cursor-pointer select-none transition-colors
                ${dragging
                  ? "border-stone-500 bg-stone-50"
                  : "border-stone-200 hover:border-stone-400 hover:bg-stone-50"
                }
              `}
            >
              {/* Upload icon */}
              <div className="mb-4 w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="text-stone-500"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>

              <p className="text-sm font-medium text-stone-800 mb-1">
                {dragging ? "Drop to upload" : "Drag and drop your file here"}
              </p>
              <p className="text-xs text-stone-400 mb-4">or</p>

              <span
                className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs
                  font-medium text-stone-700 hover:bg-stone-50 active:bg-stone-100 transition-colors"
              >
                Browse files
              </span>

              <input
                ref={inputRef}
                type="file"
                accept={ALLOWED_EXTENSIONS.join(",")}
                onChange={handleInputChange}
                className="sr-only"
                aria-hidden="true"
              />
            </div>
          )}

          {/* File preview */}
          {selectedFile && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex items-start gap-3">
                {/* File type badge */}
                <div className="mt-0.5 rounded-md bg-stone-200 px-2 py-1 text-xs font-semibold text-stone-700 shrink-0">
                  {fileTypeLabel(selectedFile.type)}
                </div>

                {/* File info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-900 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {formatBytes(selectedFile.size)}
                  </p>
                </div>

                {/* Remove button — hidden during upload */}
                {!isUploading && !isDone && (
                  <button
                    type="button"
                    onClick={clearFile}
                    aria-label="Remove file"
                    className="text-stone-400 hover:text-stone-700 transition-colors shrink-0 mt-0.5"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {(isUploading || isDone) && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-stone-400 mb-1.5">
                    <span>{isDone ? "Upload complete" : "Uploading…"}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-stone-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-stone-800 transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                      role="progressbar"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex gap-3">
            {/* Upload / retry button */}
            {(state.stage === "selected" || state.stage === "error") && (
              <button
                type="button"
                onClick={handleUpload}
                className="flex-1 rounded-lg bg-stone-900 text-white text-sm font-medium py-2.5
                  hover:bg-stone-800 active:bg-stone-950 transition-colors
                  flex items-center justify-center gap-2"
              >
                {state.stage === "error" ? "Retry upload" : "Upload document"}
              </button>
            )}

            {/* Loading state */}
            {isUploading && (
              <div className="flex-1 rounded-lg bg-stone-900 text-white text-sm font-medium py-2.5
                flex items-center justify-center gap-2 opacity-70 cursor-not-allowed">
                <span
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
                Uploading…
              </div>
            )}

            {/* Done state */}
            {isDone && (
              <div className="flex-1 rounded-lg bg-green-700 text-white text-sm font-medium py-2.5
                flex items-center justify-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Upload complete
              </div>
            )}

            {/* Change file — shown when a file is selected but not uploading */}
            {(state.stage === "selected" || state.stage === "error") && (
              <button
                type="button"
                onClick={() => { clearFile(); }}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm
                  font-medium text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Change
              </button>
            )}
          </div>

          {/* Constraints note */}
          {state.stage === "idle" && (
            <p className="mt-5 text-xs text-stone-400 text-center">
              PDF, PNG, JPEG only &mdash; maximum 20 MB per file
            </p>
          )}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-stone-400">
          &copy; {new Date().getFullYear()} SMALDA &mdash; Your documents are encrypted in transit.
        </p>
      </div>
    </main>
  );
}
