import { ValidationType, ValidationResult } from '../entities/validation-request.entity';

export interface ValidationDocumentParams {
  documentId: string;
  validationType: ValidationType;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ValidationResponse {
  result: ValidationResult;
  data: Record<string, any>;
  confidenceScore: number | null;
  externalReferenceId: string | null;
  validatedAt: Date | null;
  expiresAt: Date | null;
  metadata: Record<string, any> | null;
  success: boolean;
  errorMessage: string | null;
}

export interface IValidationProvider {
  validateDocument(params: ValidationDocumentParams): Promise<ValidationResponse>;
  healthCheck(): Promise<boolean>;
}
