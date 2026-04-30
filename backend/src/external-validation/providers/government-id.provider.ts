import { Injectable } from '@nestjs/common';
import { IValidationProvider, ValidationDocumentParams, ValidationResponse } from '../interfaces/validation-provider.interface';
import { ValidationResult } from '../entities/validation-request.entity';

@Injectable()
export class GovernmentIdProvider implements IValidationProvider {
  async validateDocument(_params: ValidationDocumentParams): Promise<ValidationResponse> {
    return {
      result: ValidationResult.VALID,
      data: {},
      confidenceScore: null,
      externalReferenceId: null,
      validatedAt: new Date(),
      expiresAt: null,
      metadata: null,
      success: true,
      errorMessage: null,
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
