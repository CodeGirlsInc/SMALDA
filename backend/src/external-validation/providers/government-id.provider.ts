import { Injectable, Logger } from "@nestjs/common"
import type {
  IValidationProvider,
  ValidationRequest,
  ValidationResponse,
  GovernmentIdValidationPayload,
} from "../interfaces/validation-provider.interface"
import { ValidationResult, ValidationType } from "../entities/validation-request.entity"

@Injectable()
export class GovernmentIdProvider implements IValidationProvider {
  private readonly logger = new Logger(GovernmentIdProvider.name)
  private readonly baseUrl = "https://api.government.id.mock"

  async validateDocument(request: ValidationRequest): Promise<ValidationResponse> {
    this.logger.log(`Starting government ID validation for document: ${request.documentId}`)

    try {
      const payload = request.payload as GovernmentIdValidationPayload

      // Mock validation logic
      const mockResponse = await this.mockGovernmentIdValidation(payload)

      return {
        success: true,
        result: mockResponse.isValid ? ValidationResult.VALID : ValidationResult.INVALID,
        data: mockResponse,
        confidenceScore: mockResponse.confidenceScore,
        externalReferenceId: mockResponse.referenceId,
        validatedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        metadata: {
          provider: "GovernmentID",
          apiVersion: "v1.3",
          processingTime: mockResponse.processingTime,
        },
      }
    } catch (error) {
      this.logger.error(`Government ID validation failed: ${error.message}`, error.stack)

      return {
        success: false,
        result: ValidationResult.ERROR,
        data: {},
        errorMessage: error.message,
        validatedAt: new Date(),
        metadata: {
          provider: "GovernmentID",
          error: true,
        },
      }
    }
  }

  private async mockGovernmentIdValidation(payload: GovernmentIdValidationPayload) {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1500))

    const processingTime = Math.floor(Math.random() * 2000) + 300

    // Mock validation logic
    const isValidId = this.validateIdNumber(payload.idNumber, payload.idType)
    const nameMatch = this.validateName(payload.fullName)
    const dobValid = payload.dateOfBirth ? this.validateDateOfBirth(payload.dateOfBirth) : true

    const overallValid = isValidId && nameMatch && dobValid
    const confidenceScore = this.calculateConfidenceScore(isValidId, nameMatch, dobValid)

    return {
      isValid: overallValid,
      confidenceScore,
      referenceId: `GID-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      processingTime,
      details: {
        idExists: isValidId,
        nameMatch,
        dateOfBirthValid: dobValid,
        idStatus: isValidId ? "ACTIVE" : "INVALID",
        issuingAuthority: payload.issuingAuthority || this.getRandomAuthority(payload.idType),
        issueDate: new Date(Date.now() - Math.random() * 10 * 365 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() + Math.random() * 5 * 365 * 24 * 60 * 60 * 1000),
        nationality: payload.nationality || "Unknown",
      },
      warnings: overallValid ? [] : this.generateWarnings(isValidId, nameMatch, dobValid),
    }
  }

  private validateIdNumber(idNumber: string, idType: string): boolean {
    // Mock validation based on ID type
    switch (idType) {
      case "passport":
        return /^[A-Z]{2}\d{7}$/.test(idNumber) // Format: AB1234567
      case "national_id":
        return /^\d{9,12}$/.test(idNumber) // 9-12 digits
      case "drivers_license":
        return /^[A-Z]\d{8}$/.test(idNumber) // Format: A12345678
      default:
        return false
    }
  }

  private validateName(fullName: string): boolean {
    // Mock validation: names with 2-4 words are valid
    const words = fullName.trim().split(" ")
    return words.length >= 2 && words.length <= 4
  }

  private validateDateOfBirth(dob: string): boolean {
    // Mock validation: valid date format and reasonable age
    const date = new Date(dob)
    const now = new Date()
    const age = now.getFullYear() - date.getFullYear()
    return !isNaN(date.getTime()) && age >= 18 && age <= 120
  }

  private calculateConfidenceScore(idValid: boolean, nameValid: boolean, dobValid: boolean): number {
    let score = 0
    if (idValid) score += 60
    if (nameValid) score += 25
    if (dobValid) score += 15
    return Math.min(score + Math.random() * 5 - 2.5, 100)
  }

  private getRandomAuthority(idType: string): string {
    const authorities = {
      passport: ["Department of State", "Foreign Ministry", "Immigration Office"],
      national_id: ["National Registration Office", "Civil Registry", "Identity Authority"],
      drivers_license: ["Department of Motor Vehicles", "Transport Authority", "Licensing Bureau"],
    }
    const options = authorities[idType] || ["Government Authority"]
    return options[Math.floor(Math.random() * options.length)]
  }

  private generateWarnings(idValid: boolean, nameValid: boolean, dobValid: boolean): string[] {
    const warnings: string[] = []
    if (!idValid) warnings.push("ID number format invalid or not found in database")
    if (!nameValid) warnings.push("Name format invalid or does not match records")
    if (!dobValid) warnings.push("Date of birth invalid or does not match records")
    return warnings
  }

  getProviderInfo() {
    return {
      name: "Government ID Provider",
      validationType: ValidationType.GOVERNMENT_ID,
      isAvailable: true,
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await new Promise((resolve) => setTimeout(resolve, 50))
      return Math.random() > 0.05 // 95% uptime simulation
    } catch {
      return false
    }
  }
}
