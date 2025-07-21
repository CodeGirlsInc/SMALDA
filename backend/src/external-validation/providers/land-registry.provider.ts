import { Injectable, Logger } from "@nestjs/common"
import type {
  IValidationProvider,
  ValidationRequest,
  ValidationResponse,
  LandRegistryValidationPayload,
} from "../interfaces/validation-provider.interface"
import { ValidationResult, ValidationType } from "../entities/validation-request.entity"

@Injectable()
export class LandRegistryProvider implements IValidationProvider {
  private readonly logger = new Logger(LandRegistryProvider.name)
  private readonly baseUrl = "https://api.landregistry.gov.mock"

  async validateDocument(request: ValidationRequest): Promise<ValidationResponse> {
    this.logger.log(`Starting land registry validation for document: ${request.documentId}`)

    try {
      const payload = request.payload as LandRegistryValidationPayload

      // Mock validation logic
      const mockResponse = await this.mockLandRegistryValidation(payload)

      return {
        success: true,
        result: mockResponse.isValid ? ValidationResult.VALID : ValidationResult.INVALID,
        data: mockResponse,
        confidenceScore: mockResponse.confidenceScore,
        externalReferenceId: mockResponse.referenceId,
        validatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        metadata: {
          provider: "LandRegistry",
          apiVersion: "v2.1",
          processingTime: mockResponse.processingTime,
        },
      }
    } catch (error) {
      this.logger.error(`Land registry validation failed: ${error.message}`, error.stack)

      return {
        success: false,
        result: ValidationResult.ERROR,
        data: {},
        errorMessage: error.message,
        validatedAt: new Date(),
        metadata: {
          provider: "LandRegistry",
          error: true,
        },
      }
    }
  }

  private async mockLandRegistryValidation(payload: LandRegistryValidationPayload) {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000))

    const processingTime = Math.floor(Math.random() * 3000) + 500

    // Mock validation logic based on property ID patterns
    const isValidProperty = this.validatePropertyId(payload.propertyId)
    const ownerMatch = this.validateOwnerName(payload.ownerName)
    const addressMatch = payload.address ? this.validateAddress(payload.address) : true

    const overallValid = isValidProperty && ownerMatch && addressMatch
    const confidenceScore = this.calculateConfidenceScore(isValidProperty, ownerMatch, addressMatch)

    return {
      isValid: overallValid,
      confidenceScore,
      referenceId: `LR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      processingTime,
      details: {
        propertyExists: isValidProperty,
        ownerNameMatch: ownerMatch,
        addressMatch,
        registrationStatus: isValidProperty ? "ACTIVE" : "NOT_FOUND",
        lastUpdated: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        propertyType: this.getRandomPropertyType(),
        registrationDate: new Date(Date.now() - Math.random() * 10 * 365 * 24 * 60 * 60 * 1000),
      },
      warnings: overallValid ? [] : this.generateWarnings(isValidProperty, ownerMatch, addressMatch),
    }
  }

  private validatePropertyId(propertyId: string): boolean {
    // Mock validation: property IDs starting with 'PROP' are valid
    return propertyId.startsWith("PROP") && propertyId.length >= 8
  }

  private validateOwnerName(ownerName: string): boolean {
    // Mock validation: names with at least 2 words are valid
    return ownerName.trim().split(" ").length >= 2
  }

  private validateAddress(address: any): boolean {
    // Mock validation: address with street and city is valid
    return address.street && address.city
  }

  private calculateConfidenceScore(propertyValid: boolean, ownerValid: boolean, addressValid: boolean): number {
    let score = 0
    if (propertyValid) score += 50
    if (ownerValid) score += 30
    if (addressValid) score += 20
    return Math.min(score + Math.random() * 10 - 5, 100) // Add some randomness
  }

  private getRandomPropertyType(): string {
    const types = ["RESIDENTIAL", "COMMERCIAL", "INDUSTRIAL", "AGRICULTURAL", "MIXED_USE"]
    return types[Math.floor(Math.random() * types.length)]
  }

  private generateWarnings(propertyValid: boolean, ownerValid: boolean, addressValid: boolean): string[] {
    const warnings: string[] = []
    if (!propertyValid) warnings.push("Property ID not found in registry")
    if (!ownerValid) warnings.push("Owner name format invalid or not found")
    if (!addressValid) warnings.push("Address information incomplete")
    return warnings
  }

  getProviderInfo() {
    return {
      name: "Land Registry Provider",
      validationType: ValidationType.LAND_REGISTRY,
      isAvailable: true,
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Mock health check
      await new Promise((resolve) => setTimeout(resolve, 100))
      return Math.random() > 0.1 // 90% uptime simulation
    } catch {
      return false
    }
  }
}
