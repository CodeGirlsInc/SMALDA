"use client"

import type React from "react"
import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { UploadIcon, X, File, ImageIcon, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

export interface UploadFile {
  id: string
  file: File
  preview?: string
  status: "pending" | "uploading" | "success" | "error"
  progress: number
  error?: string
}

interface UploadProps {
  onFilesChange?: (files: UploadFile[]) => void
  onUpload?: (files: UploadFile[]) => Promise<void>
  accept?: string
  multiple?: boolean
  maxSize?: number // in bytes
  maxFiles?: number
  disabled?: boolean
  className?: string
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
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const createUploadFile = useCallback((file: File): UploadFile => {
    return {
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      status: "pending",
      progress: 0,
    }
  }, [])

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxSize) {
        return `File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`
      }
      return null
    },
    [maxSize],
  )

  const handleFileSelect = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles || disabled) return

      const newFiles: UploadFile[] = []
      const currentFileCount = files.length

      for (let i = 0; i < selectedFiles.length; i++) {
        if (currentFileCount + newFiles.length >= maxFiles) break

        const file = selectedFiles[i]
        const error = validateFile(file)

        const uploadFile = createUploadFile(file)
        if (error) {
          uploadFile.status = "error"
          uploadFile.error = error
        }

        // Create preview for images
        if (file.type.startsWith("image/")) {
          const reader = new FileReader()
          reader.onload = (e) => {
            uploadFile.preview = e.target?.result as string
            setFiles((prev) => [...prev])
          }
          reader.readAsDataURL(file)
        }

        newFiles.push(uploadFile)
      }

      const updatedFiles = [...files, ...newFiles]
      setFiles(updatedFiles)
      onFilesChange?.(updatedFiles)
    },
    [files, maxFiles, validateFile, createUploadFile, onFilesChange, disabled],
  )
  
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!disabled) {
        setIsDragOver(true)
      }
    },
    [disabled],
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      if (!disabled) {
        handleFileSelect(e.dataTransfer.files)
      }
    },
    [handleFileSelect, disabled],
  )

  const removeFile = useCallback(
    (fileId: string) => {
      const updatedFiles = files.filter((f) => f.id !== fileId)
      setFiles(updatedFiles)
      onFilesChange?.(updatedFiles)
    },
    [files, onFilesChange],
  )

  const handleUpload = useCallback(async () => {
    if (!onUpload || disabled) return

    const filesToUpload = files.filter((f) => f.status === "pending")
    if (filesToUpload.length === 0) return

    // Update status to uploading
    setFiles((prev) =>
      prev.map((f) =>
        filesToUpload.some((upload) => upload.id === f.id) ? { ...f, status: "uploading" as const, progress: 0 } : f,
      ),
    )

    try {
      await onUpload(filesToUpload)

      // Update status to success
      setFiles((prev) =>
        prev.map((f) =>
          filesToUpload.some((upload) => upload.id === f.id) ? { ...f, status: "success" as const, progress: 100 } : f,
        ),
      )
    } catch (error) {
      // Update status to error
      setFiles((prev) =>
        prev.map((f) =>
          filesToUpload.some((upload) => upload.id === f.id)
            ? { ...f, status: "error" as const, error: error instanceof Error ? error.message : "Upload failed" }
            : f,
        ),
      )
    }
  }, [files, onUpload, disabled])

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return <ImageIcon className="h-4 w-4" />
    if (file.type.includes("text/") || file.type.includes("document")) return <FileText className="h-4 w-4" />
    return <File className="h-4 w-4" />
  }

  const pendingFiles = files.filter((f) => f.status === "pending")
  const hasUploadableFiles = pendingFiles.length > 0

  return (
    <div className={cn("space-y-4", className)}>
      <Card
        className={cn(
          "border-2 border-dashed transition-colors",
          isDragOver && !disabled && "border-primary bg-primary/5",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <UploadIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <div>
              <p className="text-lg font-medium">{isDragOver ? "Drop files here" : "Drag and drop files here"}</p>
              <p className="text-sm text-muted-foreground">or click to browse files</p>
            </div>
