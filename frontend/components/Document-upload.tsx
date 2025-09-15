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