export interface FileUploadProps {
  allowedMimeTypes?: string[];
  maxFileSizeBytes?: number;
  onFileSelect?: (file: File) => void;
  label?: string;
}

export interface FileValidationResult {
  isValid: boolean;
  errorMessage?: string;
}
