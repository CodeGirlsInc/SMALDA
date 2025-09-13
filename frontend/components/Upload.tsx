"use client";

import type React from "react";
import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UploadIcon, X, File, ImageIcon, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadFile {
  id: string;
  file: File;
  preview?: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

interface UploadProps {
  onFilesChange?: (files: UploadFile[]) => void;
  onUpload?: (files: UploadFile[]) => Promise<void>;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

export function Upload({
  onFilesChange,
  onUpload,
  accept = "*/*",
  multiple = true,
  maxSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 5,
  disabled = false,
  className,
}: UploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createUploadFile = useCallback((file: File): UploadFile => {
    return {
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      status: "pending",
      progress: 0,
    };
  }, []);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxSize) {
        return `File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`;
      }
      return null;
    },
    [maxSize]
  );

  const handleFileSelect = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles || disabled) return;

      const newFiles: UploadFile[] = [];
      const currentFileCount = files.length;

      for (let i = 0; i < selectedFiles.length; i++) {
        if (currentFileCount + newFiles.length >= maxFiles) break;

        const file = selectedFiles[i];
        const error = validateFile(file);

        const uploadFile = createUploadFile(file);
        if (error) {
          uploadFile.status = "error";
          uploadFile.error = error;
        }

        // Create preview for images
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (e) => {
            uploadFile.preview = e.target?.result as string;
            setFiles((prev) => [...prev]);
          };
          reader.readAsDataURL(file);
        }

        newFiles.push(uploadFile);
      }

      const updatedFiles = [...files, ...newFiles];
      setFiles(updatedFiles);
      onFilesChange?.(updatedFiles);
    },
    [files, maxFiles, validateFile, createUploadFile, onFilesChange, disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (!disabled) {
        handleFileSelect(e.dataTransfer.files);
      }
    },
    [handleFileSelect, disabled]
  );

  const removeFile = useCallback(
    (fileId: string) => {
      const updatedFiles = files.filter((f) => f.id !== fileId);
      setFiles(updatedFiles);
      onFilesChange?.(updatedFiles);
    },
    [files, onFilesChange]
  );

  const handleUpload = useCallback(async () => {
    if (!onUpload || disabled) return;

    const filesToUpload = files.filter((f) => f.status === "pending");
    if (filesToUpload.length === 0) return;

    // Update status to uploading
    setFiles((prev) =>
      prev.map((f) =>
        filesToUpload.some((upload) => upload.id === f.id)
          ? { ...f, status: "uploading" as const, progress: 0 }
          : f
      )
    );

    try {
      await onUpload(filesToUpload);

      // Update status to success
      setFiles((prev) =>
        prev.map((f) =>
          filesToUpload.some((upload) => upload.id === f.id)
            ? { ...f, status: "success" as const, progress: 100 }
            : f
        )
      );
    } catch (error) {
      // Update status to error
      setFiles((prev) =>
        prev.map((f) =>
          filesToUpload.some((upload) => upload.id === f.id)
            ? {
                ...f,
                status: "error" as const,
                error: error instanceof Error ? error.message : "Upload failed",
              }
            : f
        )
      );
    }
  }, [files, onUpload, disabled]);

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/"))
      return <ImageIcon className="h-4 w-4" />;
    if (file.type.includes("text/") || file.type.includes("document"))
      return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const pendingFiles = files.filter((f) => f.status === "pending");
  const hasUploadableFiles = pendingFiles.length > 0;

  return (
    <div className={cn("space-y-4", className)}>
      <Card
        className={cn(
          "border-2 border-dashed transition-colors",
          isDragOver && !disabled && "border-primary bg-primary/5",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <UploadIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <div>
              <p className="text-lg font-medium">
                {isDragOver ? "Drop files here" : "Drag and drop files here"}
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse files
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              data-testid="browse-button"
            >
              Browse Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              multiple={multiple}
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
              disabled={disabled}
              data-testid="file-input"
            />
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">Selected Files</h3>
          <div className="space-y-2" data-testid="file-list">
            {files.map((uploadFile) => (
              <Card key={uploadFile.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {uploadFile.preview ? (
                      <img
                        src={uploadFile.preview || "/placeholder.svg"}
                        alt={uploadFile.file.name}
                        className="h-10 w-10 object-cover rounded"
                      />
                    ) : (
                      getFileIcon(uploadFile.file)
                    )}
                    <div>
                      <p className="font-medium text-sm">
                        {uploadFile.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(uploadFile.file.size / 1024).toFixed(1)} KB
                      </p>
                      {uploadFile.status === "uploading" && (
                        <div className="w-32 bg-secondary rounded-full h-1 mt-1">
                          <div
                            className="bg-primary h-1 rounded-full transition-all"
                            style={{ width: `${uploadFile.progress}%` }}
                          />
                        </div>
                      )}
                      {uploadFile.error && (
                        <p className="text-xs text-destructive">
                          {uploadFile.error}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        uploadFile.status === "pending" &&
                          "bg-secondary text-secondary-foreground",
                        uploadFile.status === "uploading" &&
                          "bg-blue-100 text-blue-800",
                        uploadFile.status === "success" &&
                          "bg-green-100 text-green-800",
                        uploadFile.status === "error" &&
                          "bg-red-100 text-red-800"
                      )}
                    >
                      {uploadFile.status}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFile(uploadFile.id)}
                      disabled={disabled || uploadFile.status === "uploading"}
                      data-testid={`remove-file-${uploadFile.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {hasUploadableFiles && onUpload && (
            <Button
              onClick={handleUpload}
              disabled={disabled || !hasUploadableFiles}
              className="w-full"
              data-testid="upload-button"
            >
              Upload {pendingFiles.length} file
              {pendingFiles.length !== 1 ? "s" : ""}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
