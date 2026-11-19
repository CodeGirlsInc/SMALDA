import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ValidationType,
  ValidationStatus,
  ValidationResult,
} from '../entities/validation-request.entity';
import { IsBoundedJson, MAX_JSON_PAYLOAD_BYTES } from './bounded-json.util';

/**
 * Internal shape used by the service. The HTTP body is validated with
 * CreateExternalValidationBodyDto before it reaches this object.
 */
export class CreateValidationRequestDto {
  documentId: string;
  validationType: ValidationType;
  requestPayload?: Record<string, any>;
  requestedBy: string;
  metadata?: Record<string, any>;
}

/**
 * HTTP body for POST /documents/:id/external-validation.
 *
 * A DTO class (rather than an inline object type) is required so the global
 * ValidationPipe actually validates the body: without it any validationType
 * would be accepted and arbitrary JSON could be posted.
 */
export class CreateExternalValidationBodyDto {
  @IsEnum(ValidationType)
  validationType: ValidationType;

  @IsOptional()
  @IsObject()
  @IsBoundedJson()
  requestPayload?: Record<string, any>;

  @IsOptional()
  @IsObject()
  @IsBoundedJson()
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
  @IsOptional()
  @IsObject()
  @IsBoundedJson()
  updatedPayload?: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export { MAX_JSON_PAYLOAD_BYTES };
