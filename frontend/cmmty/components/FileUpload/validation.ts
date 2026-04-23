import { FileValidationResult } from "./types";

export function validateFile(
  file: File,
  allowedMimeTypes: string[] = [],
  maxFileSizeBytes?: number,
): FileValidationResult {
  if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.type)) {
    return {
      isValid: false,
      errorMessage: "Unsupported file type.",
    };
  }

  if (maxFileSizeBytes && file.size > maxFileSizeBytes) {
    return {
      isValid: false,
      errorMessage: `File exceeds max size of ${Math.round(maxFileSizeBytes / (1024 * 1024))}MB.`,
    };
  }

  return { isValid: true };
}
