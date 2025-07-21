import { Test, type TestingModule } from "@nestjs/testing"
import { LandRegistryProvider } from "./land-registry.provider"
import { ValidationType, ValidationResult } from "../entities/validation-request.entity"

describe("LandRegistryProvider", () => {
  let provider: LandRegistryProvider

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LandRegistryProvider],
    }).compile()

    provider = module.get<LandRegistryProvider>(LandRegistryProvider)
  })

  describe("validateDocument", () => {
    const mockRequest = {
      documentId: "doc-123",
      validationType: ValidationType.LAND_REGISTRY,
      payload: {
        propertyId: "PROP123456",
        ownerName: "John Doe",
        registrationNumber: "REG789",
        address: {
          street: "123 Main St",
          city: "Anytown",
          state: "CA",
          zipCode: "12345",
          country: "USA",
        },
        documentType: "TITLE_DEED",
      },
    }

    it("should validate a valid property document", async () => {
      const result = await provider.validateDocument(mockRequest)

      expect(result.success).toBe(true)
      expect(result.result).toBe(ValidationResult.VALID)
      expect(result.data.isValid).toBe(true)
      expect(result.confidenceScore).toBeGreaterThan(0)
      expect(result.externalReferenceId).toMatch(/^LR-/)
      expect(result.validatedAt).toBeInstanceOf(Date)
      expect(result.expiresAt).toBeInstanceOf(Date)
    })

    it("should reject invalid property ID", async () => {
      const invalidRequest = {
        ...mockRequest,
        payload: {
          ...mockRequest.payload,
          propertyId: "INVALID123", // Doesn't start with PROP
        },
      }

      const result = await provider.validateDocument(invalidRequest)

      expect(result.success).toBe(true)
      expect(result.result).toBe(ValidationResult.INVALID)
      expect(result.data.isValid).toBe(false)
      expect(result.data.warnings).toContain("Property ID not found in registry")
    })

    it("should handle validation errors", async () => {
      // Mock an error by providing invalid payload structure
      const errorRequest = {
        ...mockRequest,
        payload: null,
      }

      const result = await provider.validateDocument(errorRequest)

      expect(result.success).toBe(false)
      expect(result.result).toBe(ValidationResult.ERROR)
      expect(result.errorMessage).toBeDefined()
    })
  })

  describe("getProviderInfo", () => {
    it("should return provider information", () => {
      const info = provider.getProviderInfo()

      expect(info.name).toBe("Land Registry Provider")
      expect(info.validationType).toBe(ValidationType.LAND_REGISTRY)
      expect(info.isAvailable).toBe(true)
    })
  })

  describe("healthCheck", () => {
    it("should return health status", async () => {
      const isHealthy = await provider.healthCheck()

      expect(typeof isHealthy).toBe("boolean")
    })
  })
})
