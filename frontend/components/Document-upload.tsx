"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, File, X, CheckCircle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface UploadedFile {
  file: File
  id: string
  preview?: string
}

const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export default function DocumentUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const validateFile = (file: File): string | null => {
    // Check file type
    const isValidType = Object.keys(ACCEPTED_FILE_TYPES).includes(file.type)
    if (!isValidType) {
      return `${file.name}: Invalid file type. Please upload PDF, PNG, or JPEG files only.`
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: File size too large. Maximum size is 10MB.`
    }

    return null
  }

  const processFiles = useCallback((fileList: FileList) => {
    const newFiles: UploadedFile[] = []
    const newErrors: string[] = []
    
    Array.from(fileList).forEach((file) => {
      const error = validateFile(file)
      if (error) {
        newErrors.push(error)
        return
      }

      const id = Math.random().toString(36).substr(2, 9)
      const uploadedFile: UploadedFile = {
        file,
        id,
      }

      // Create preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (e) => {
          setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, preview: e.target?.result as string } : f)))
        }
        reader.readAsDataURL(file)
      }

      newFiles.push(uploadedFile)
    })

    setFiles((prev) => [...prev, ...newFiles])
    setErrors(newErrors)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)

      const droppedFiles = e.dataTransfer.files
      if (droppedFiles.length > 0) {
        processFiles(droppedFiles)
      }
    },
    [processFiles],
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files
      if (selectedFiles && selectedFiles.length > 0) {
        processFiles(selectedFiles)
      }
      // Reset input value to allow selecting the same file again
      e.target.value = ""
    },
    [processFiles],
  )

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id))
  }, [])

  const clearErrors = useCallback(() => {
    setErrors([])
  }, [])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getFileIcon = (file: File) => {
    if (file.type === "application/pdf") {
      return <File className="h-8 w-8 text-red-500" />
    }
    return <File className="h-8 w-8 text-blue-500" />
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card className="p-8">
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
