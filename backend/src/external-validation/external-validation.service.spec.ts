import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import type { Repository } from "typeorm"
import { ExternalValidationService } from "./external-validation.service"
import {
  ValidationRequest,
  ValidationProvider,
  ValidationType,
  ValidationStatus,
  ValidationResult,
} from "./entities/validation-request.entity"
import { LandRegistryProvider } from "./providers/land-registry.provider"
import { GovernmentIdProvider } from "./providers/government-id.provider"
import { BusinessRegistrationProvider } from "./providers/business-registration.provider"
import { jest } from "@jest/globals"

describe("ExternalValidationService", () => {
  let service: ExternalValidationService
  let validationRequestRepository: Repository<ValidationRequest>
  let validationProviderRepository: Repository<ValidationProvider>

  const mockValidationRequestRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const mockValidationProviderRepository = {
    find: jest.fn(),
  }

  const mockLandRegistryProvider = {
    validateDocument: jest.fn(),
    getProviderInfo: jest.fn(),
    healthCheck: jest.fn(),
  }

  const mockGovernmentIdProvider = {
    validateDocument: jest.fn(),
    getProviderInfo: jest.fn(),
    healthCheck: jest.fn(),
  }

  const mockBusinessRegistrationProvider = {
    validateDocument: jest.fn(),
    getProviderInfo: jest.fn(),
    healthCheck: jest.fn(),
  }

  const mockQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    select: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExternalValidationService,
        {
          provide: getRepositoryToken(ValidationRequest),
          useValue: mockValidationRequestRepository,
        },
        {
          provide: getRepositoryToken(ValidationProvider),
          useValue: mockValidationProviderRepository,
        },
        {
          provide: LandRegistryProvider,
          useValue: mockLandRegistryProvider,
        },
        {
          provide: GovernmentIdProvider,
          useValue: mockGovernmentIdProvider,
        },
        {
          provide: BusinessRegistrationProvider,
          useValue: mockBusinessRegistrationProvider,
        },
      ],
    }).compile()

    service = module.get<ExternalValidationService>(ExternalValidationService)
    validationRequestRepository = module.get<Repository<ValidationRequest>>(getRepositoryToken(ValidationRequest))
    validationProviderRepository = module.get<Repository<ValidationProvider>>(getRepositoryToken(ValidationProvider))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("createValidationRequest", () => {
    const createDto = {
      documentId: "doc-123",
      validationType: ValidationType.LAND_REGISTRY,
      requestPayload: { propertyId: "PROP123" },
      requestedBy: "user-123",
    }

    it("should create a validation request", async () => {
      const mockRequest = {
        id: "req-123",
        ...createDto,
        status: ValidationStatus.PENDING,
      }

      mockValidationRequestRepository.create.mockReturnValue(mockRequest)
      mockValidationRequestRepository.save.mockResolvedValue(mockRequest)

      const result = await service.createValidationRequest(createDto)

      expect(validationRequestRepository.create).toHaveBeenCalledWith({
        documentId: createDto.documentId,
        validationType: createDto.validationType,
        requestPayload: createDto.requestPayload,
        requestedBy: createDto.requestedBy,
        metadata: createDto.metadata,
        status: ValidationStatus.PENDING,
      })
      expect(result).toEqual(mockRequest)
    })

    it("should throw BadRequestException for unsupported validation type", async () => {
      const invalidDto = {
        ...createDto,
        validationType: "UNSUPPORTED_TYPE" as ValidationType,
      }

      await expect(service.createValidationRequest(invalidDto)).rejects.toThrow(BadRequestException)
    })
  })

  describe("processValidation", () => {
    const mockRequest = {
      id: "req-123",
      documentId: "doc-123",
      validationType: ValidationType.LAND_REGISTRY,
      requestPayload: { propertyId: "PROP123" },
      status: ValidationStatus.PENDING,
    }

    it("should process validation successfully", async () => {
      const mockValidationResponse = {
        success: true,
        result: ValidationResult.VALID,
        data: { isValid: true },
        confidenceScore: 95,
        externalReferenceId: "ext-123",
        validatedAt: new Date(),
        expiresAt: new Date(),
      }

      mockValidationRequestRepository.findOne.mockResolvedValue(mockRequest)
      mockLandRegistryProvider.validateDocument.mockResolvedValue(mockValidationResponse)
      mockValidationRequestRepository.save.mockResolvedValue({
        ...mockRequest,
        status: ValidationStatus.COMPLETED,
        result: ValidationResult.VALID,
      })

      const result = await service.processValidation("req-123")

      expect(mockLandRegistryProvider.validateDocument).toHaveBeenCalledWith({
        documentId: mockRequest.documentId,
        validationType: mockRequest.validationType,
        payload: mockRequest.requestPayload,
        metadata: mockRequest.metadata,
      })
      expect(result.status).toBe(ValidationStatus.COMPLETED)
      expect(result.result).toBe(ValidationResult.VALID)
    })

    it("should handle validation errors", async () => {
      mockValidationRequestRepository.findOne.mockResolvedValue(mockRequest)
      mockLandRegistryProvider.validateDocument.mockRejectedValue(new Error("Provider error"))
      mockValidationRequestRepository.save.mockResolvedValue({
        ...mockRequest,
        status: ValidationStatus.FAILED,
        result: ValidationResult.ERROR,
      })

      const result = await service.processValidation("req-123")

      expect(result.status).toBe(ValidationStatus.FAILED)
      expect(result.result).toBe(ValidationResult.ERROR)
    })

    it("should throw NotFoundException for non-existent request", async () => {
      mockValidationRequestRepository.findOne.mockResolvedValue(null)

      await expect(service.processValidation("req-123")).rejects.toThrow(NotFoundException)
    })

    it("should throw BadRequestException for non-pending request", async () => {
      const completedRequest = {
        ...mockRequest,
        status: ValidationStatus.COMPLETED,
      }

      mockValidationRequestRepository.findOne.mockResolvedValue(completedRequest)

      await expect(service.processValidation("req-123")).rejects.toThrow(BadRequestException)
    })
  })

  describe("findAll", () => {
    it("should return paginated validation requests with filters", async () => {
      const queryDto = {
        documentId: "doc-123",
        validationType: ValidationType.LAND_REGISTRY,
        limit: 10,
        offset: 0,
      }

      const mockRequests = [{ id: "req-1" }, { id: "req-2" }]

      mockValidationRequestRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockRequests, 2])

      const result = await service.findAll(queryDto)

      expect(validationRequestRepository.createQueryBuilder).toHaveBeenCalledWith("validation_request")
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith("validation_request.documentId = :documentId", {
        documentId: "doc-123",
      })
      expect(result).toEqual({ requests: mockRequests, total: 2 })
    })
  })

  describe("checkProviderHealth", () => {
    it("should check health of all providers", async () => {
      mockLandRegistryProvider.healthCheck.mockResolvedValue(true)
      mockGovernmentIdProvider.healthCheck.mockResolvedValue(false)
      mockBusinessRegistrationProvider.healthCheck.mockResolvedValue(true)

      const result = await service.checkProviderHealth()

      expect(result).toEqual({
        [ValidationType.LAND_REGISTRY]: true,
        [ValidationType.GOVERNMENT_ID]: false,
        [ValidationType.BUSINESS_REGISTRATION]: true,
      })
    })

    it("should handle provider health check errors", async () => {
      mockLandRegistryProvider.healthCheck.mockRejectedValue(new Error("Health check failed"))

      const result = await service.checkProviderHealth()

      expect(result[ValidationType.LAND_REGISTRY]).toBe(false)
    })
  })

  describe("isDocumentValidated", () => {
    it("should return validation status for document", async () => {
      const mockValidations = [
        {
          id: "val-1",
          status: ValidationStatus.COMPLETED,
          result: ValidationResult.VALID,
        },
        {
          id: "val-2",
          status: ValidationStatus.COMPLETED,
          result: ValidationResult.INVALID,
        },
      ]

      mockValidationRequestRepository.find.mockResolvedValue(mockValidations)

      const result = await service.isDocumentValidated("doc-123")

      expect(result.isValidated).toBe(true)
      expect(result.validationResults).toEqual(mockValidations)
    })

    it("should return false for document with no valid validations", async () => {
      const mockValidations = [
        {
          id: "val-1",
          status: ValidationStatus.COMPLETED,
          result: ValidationResult.INVALID,
        },
      ]

      mockValidationRequestRepository.find.mockResolvedValue(mockValidations)

      const result = await service.isDocumentValidated("doc-123")

      expect(result.isValidated).toBe(false)
    })
  })
})
