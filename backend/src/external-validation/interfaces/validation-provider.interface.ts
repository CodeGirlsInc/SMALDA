import type { ValidationResult, ValidationType } from "../entities/validation-request.entity"

export interface ValidationResponse {
  success: boolean
  result: ValidationResult
  data: Record<string, any>
  confidenceScore?: number
  externalReferenceId?: string
  validatedAt: Date
  expiresAt?: Date
  errorMessage?: string
  metadata?: Record<string, any>
}

export interface ValidationRequest {
  documentId: string
  validationType: ValidationType
  payload: Record<string, any>
  metadata?: Record<string, any>
}

export interface IValidationProvider {
  validateDocument(request: ValidationRequest): Promise<ValidationResponse>
  getProviderInfo(): {
    name: string
    validationType: ValidationType
    isAvailable: boolean
  }
  healthCheck(): Promise<boolean>
}

export interface LandRegistryValidationPayload {
  propertyId: string
  ownerName: string
  registrationNumber?: string
  address?: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  documentType: string
}

export interface GovernmentIdValidationPayload {
  idNumber: string
  idType: "passport" | "national_id" | "drivers_license"
  fullName: string
  dateOfBirth?: string
  nationality?: string
  issuingAuthority?: string
}

export interface BusinessRegistrationPayload {
  businessName: string
  registrationNumber: string
  businessType: string
  registrationDate?: string
  address?: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
}
