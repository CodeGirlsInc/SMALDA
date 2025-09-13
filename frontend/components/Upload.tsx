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