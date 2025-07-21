import { Injectable, Logger } from "@nestjs/common"
import type {
  IValidationProvider,
  ValidationRequest,
  ValidationResponse,
  BusinessRegistrationPayload,
} from "../interfaces/validation-provider.interface"
import { ValidationResult, ValidationType } from "../entities/validation-request.entity"

@Injectable()
export class BusinessRegistrationProvider implements IValidationProvider {
  private readonly logger = new Logger(BusinessRegistrationProvider.name)
  private readonly baseUrl = "https://api.businessregistry.gov.mock"

  async validateDocument(request: ValidationRequest): Promise<ValidationResponse> {
    this.logger.log(`Starting business registration validation for document: ${request.documentId}`)

    try {
      const payload = request.payload as BusinessRegistrationPayload

      const mockResponse = await this.mockBusinessRegistrationValidation(payload)

      return {
        success: true,
        result: mockResponse.isValid ? ValidationResult.VALID : ValidationResult.INVALID,
        data: mockResponse,
        confidenceScore: mockResponse.confidenceScore,
        externalReferenceId: mockResponse.referenceId,
        validatedAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        metadata: {
          provider: "BusinessRegistry",
          apiVersion: "v2.0",
          processingTime: mockResponse.processingTime,
        },
      }
    } catch (error) {
      this.logger.error(`Business registration validation failed: ${error.message}`, error.stack)

      return {
        success: false,
        result: ValidationResult.ERROR,
        data: {},
        errorMessage: error.message,
        validatedAt: new Date(),
        metadata: {
          provider: "BusinessRegistry",
          error: true,
        },
      }
    }
  }

  private async mockBusinessRegistrationValidation(payload: BusinessRegistrationPayload) {
    await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 1800))

    const processingTime = Math.floor(Math.random() * 2500) + 600

    const isValidRegistration = this.validateRegistrationNumber(payload.registrationNumber)
    const nameMatch = this.validateBusinessName(payload.businessName)
    const typeValid = this.validateBusinessType(payload.businessType)

    const overallValid = isValidRegistration && nameMatch && typeValid
    const confidenceScore = this.calculateConfidenceScore(isValidRegistration, nameMatch, typeValid)

    return {
      isValid: overallValid,
      confidenceScore,
      referenceId: `BR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      processingTime,
      details: {
        registrationExists: isValidRegistration,
        businessNameMatch: nameMatch,
        businessTypeValid: typeValid,
        registrationStatus: isValidRegistration ? this.getRandomStatus() : "NOT_FOUND",
        incorporationDate: payload.registrationDate || this.getRandomDate(),
        businessType: payload.businessType,
        registrationAuthority: this.getRandomAuthority(),
        taxId: this.generateMockTaxId(),
        directors: this.generateMockDirectors(),
        address: payload.address || this.generateMockAddress(),
      },
      warnings: overallValid ? [] : this.generateWarnings(isValidRegistration, nameMatch, typeValid),
    }
  }

  private validateRegistrationNumber(regNumber: string): boolean {
    // Mock validation: registration numbers with specific patterns
    return /^(REG|BUS|INC)\d{6,10}$/.test(regNumber)
  }

  private validateBusinessName(businessName: string): boolean {
    // Mock validation: business names with reasonable length
    return businessName.length >= 3 && businessName.length <= 100
  }

  private validateBusinessType(businessType: string): boolean {
    const validTypes = [
      "LLC",
      "Corporation",
      "Partnership",
      "Sole Proprietorship",
      "Non-Profit",
      "Cooperative",
      "Limited Partnership",
    ]
    return validTypes.includes(businessType)
  }

  private calculateConfidenceScore(regValid: boolean, nameValid: boolean, typeValid: boolean): number {
    let score = 0
    if (regValid) score += 50
    if (nameValid) score += 30
    if (typeValid) score += 20
    return Math.min(score + Math.random() * 8 - 4, 100)
  }

  private getRandomStatus(): string {
    const statuses = ["ACTIVE", "GOOD_STANDING", "SUSPENDED", "DISSOLVED"]
    return statuses[Math.floor(Math.random() * statuses.length)]
  }

  private getRandomDate(): string {
    const date = new Date(Date.now() - Math.random() * 10 * 365 * 24 * 60 * 60 * 1000)
    return date.toISOString().split("T")[0]
  }

  private getRandomAuthority(): string {
    const authorities = [
      "Secretary of State",
      "Department of Commerce",
      "Business Registration Office",
      "Corporate Registry",
    ]
    return authorities[Math.floor(Math.random() * authorities.length)]
  }

  private generateMockTaxId(): string {
    return `${Math.floor(Math.random() * 90 + 10)}-${Math.floor(Math.random() * 9000000 + 1000000)}`
  }

  private generateMockDirectors(): string[] {
    const names = ["John Smith", "Jane Doe", "Michael Johnson", "Sarah Wilson", "David Brown"]
    const count = Math.floor(Math.random() * 3) + 1
    return names.slice(0, count)
  }

  private generateMockAddress(): any {
    return {
      street: `${Math.floor(Math.random() * 9999) + 1} Business St`,
      city: "Commerce City",
      state: "CA",
      zipCode: `${Math.floor(Math.random() * 90000) + 10000}`,
      country: "USA",
    }
  }

  private generateWarnings(regValid: boolean, nameValid: boolean, typeValid: boolean): string[] {
    const warnings: string[] = []
    if (!regValid) warnings.push("Registration number not found or invalid format")
    if (!nameValid) warnings.push("Business name format invalid")
    if (!typeValid) warnings.push("Business type not recognized")
    return warnings
  }

  getProviderInfo() {
    return {
      name: "Business Registration Provider",
      validationType: ValidationType.BUSINESS_REGISTRATION,
      isAvailable: true,
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await new Promise((resolve) => setTimeout(resolve, 75))
      return Math.random() > 0.08 // 92% uptime simulation
    } catch {
      return false
    }
  }
}
