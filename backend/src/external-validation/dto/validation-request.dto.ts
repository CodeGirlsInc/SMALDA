import { ValidationType, ValidationStatus, ValidationResult } from '../entities/validation-request.entity';

export class CreateValidationRequestDto {
  documentId: string;
  validationType: ValidationType;
  requestPayload?: Record<string, any>;
  requestedBy: string;
  metadata?: Record<string, any>;
}

export class QueryValidationRequestDto {
  documentId?: string;
  validationType?: ValidationType;
  status?: ValidationStatus;
  result?: ValidationResult;
  requestedBy?: string;
  limit?: number;
  offset?: number;
}

export class RetryValidationDto {
  updatedPayload?: Record<string, any>;
  reason?: string;
}
