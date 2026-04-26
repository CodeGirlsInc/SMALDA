"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { FileUploadProps } from "./types";
import { validateFile } from "./validation";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({
  allowedMimeTypes = [],
  maxFileSizeBytes,
  onFileSelect,
  label = "Drag and drop a file here, or click to browse",
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File | null) => {
    if (!file) return;

    const result = validateFile(file, allowedMimeTypes, maxFileSizeBytes);
    if (!result.isValid) {
      setSelectedFile(null);
      setErrorMessage(result.errorMessage ?? "Invalid file");
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);
    onFileSelect?.(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    processFile(event.dataTransfer.files.item(0));
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    processFile(event.target.files?.item(0) ?? null);
  };

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 sm:p-8 text-center min-h-[120px] transition ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-blue-400"
        }`}
      >
        <UploadCloud className="mb-2 h-7 w-7 text-gray-600" />
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {allowedMimeTypes.length > 0 ? (
          <p className="mt-1 text-xs text-gray-500">
            Allowed types: {allowedMimeTypes.join(", ")}
          </p>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onChange}
        accept={allowedMimeTypes.length > 0 ? allowedMimeTypes.join(",") : undefined}
      />

      {selectedFile ? (
        <div className="mt-3 rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-700">
          <p><span className="font-medium">Name:</span> {selectedFile.name}</p>
          <p><span className="font-medium">Size:</span> {formatFileSize(selectedFile.size)}</p>
          <p><span className="font-medium">Type:</span> {selectedFile.type || "Unknown"}</p>
        </div>
      ) : null}

      {errorMessage ? <p className="mt-2 text-xs text-red-600">{errorMessage}</p> : null}
    </div>
  );
}
