import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common"
import type { Repository } from "typeorm"
import {
  type ValidationRequest,
  type ValidationProvider,
  ValidationStatus,
  ValidationResult,
  ValidationType,
} from "./entities/validation-request.entity"
import type {
  CreateValidationRequestDto,
  QueryValidationRequestDto,
  RetryValidationDto,
} from "./dto/validation-request.dto"
import type { IValidationProvider } from "./interfaces/validation-provider.interface"
import type { LandRegistryProvider } from "./providers/land-registry.provider"
import type { GovernmentIdProvider } from "./providers/government-id.provider"
import type { BusinessRegistrationProvider } from "./providers/business-registration.provider"

@Injectable()
export class ExternalValidationService {
  private readonly logger = new Logger(ExternalValidationService.name)
  private readonly providers = new Map<ValidationType, IValidationProvider>()

  constructor(
    private validationRequestRepository: Repository<ValidationRequest>,
    private validationProviderRepository: Repository<ValidationProvider>,
    private landRegistryProvider: LandRegistryProvider,
    private governmentIdProvider: GovernmentIdProvider,
    private businessRegistrationProvider: BusinessRegistrationProvider,
  ) {
    this.initializeProviders()
  }

  private initializeProviders() {
    this.providers.set(ValidationType.LAND_REGISTRY, this.landRegistryProvider)
    this.providers.set(ValidationType.GOVERNMENT_ID, this.governmentIdProvider)
    this.providers.set(ValidationType.BUSINESS_REGISTRATION, this.businessRegistrationProvider)

    this.logger.log(`Initialized ${this.providers.size} validation providers`)
  }

  async createValidationRequest(createDto: CreateValidationRequestDto): Promise<ValidationRequest> {
    this.logger.log(`Creating validation request for document: ${createDto.documentId}`)

    // Check if provider is available
    const provider = this.providers.get(createDto.validationType)
    if (!provider) {
      throw new BadRequestException(`No provider available for validation type: ${createDto.validationType}`)
    }

    // Create validation request record
    const validationRequest = this.validationRequestRepository.create({
      documentId: createDto.documentId,
      validationType: createDto.validationType,
      requestPayload: createDto.requestPayload,
      requestedBy: createDto.requestedBy,
      metadata: createDto.metadata,
      status: ValidationStatus.PENDING,
    })

    const savedRequest = await this.validationRequestRepository.save(validationRequest)

    // Process validation asynchronously
    this.processValidationAsync(savedRequest.id)

    return savedRequest
  }

  private async processValidationAsync(requestId: string) {
    try {
      await this.processValidation(requestId)
    } catch (error) {
      this.logger.error(`Async validation processing failed for request ${requestId}: ${error.message}`, error.stack)
    }
  }

  async processValidation(requestId: string): Promise<ValidationRequest> {
    const request = await this.validationRequestRepository.findOne({ where: { id: requestId } })
    if (!request) {
      throw new NotFoundException(`Validation request ${requestId} not found`)
    }

    if (request.status !== ValidationStatus.PENDING) {
      throw new BadRequestException(`Validation request ${requestId} is not in pending status`)
    }

    this.logger.log(`Processing validation request: ${requestId}`)

    // Update status to in progress
    request.status = ValidationStatus.IN_PROGRESS
    await this.validationRequestRepository.save(request)

    try {
      const provider = this.providers.get(request.validationType)
      if (!provider) {
        throw new Error(`No provider available for validation type: ${request.validationType}`)
      }

      // Perform validation
      const validationResponse = await provider.validateDocument({
        documentId: request.documentId,
        validationType: request.validationType,
        payload: request.requestPayload,
        metadata: request.metadata,
      })

      // Update request with response
      request.status = ValidationStatus.COMPLETED
      request.result = validationResponse.result
      request.responsePayload = validationResponse.data
      request.validationDetails = {
        confidenceScore: validationResponse.confidenceScore,
        externalReferenceId: validationResponse.externalReferenceId,
        validatedAt: validationResponse.validatedAt,
        expiresAt: validationResponse.expiresAt,
        metadata: validationResponse.metadata,
      }
      request.validatedAt = validationResponse.validatedAt
      request.expiresAt = validationResponse.expiresAt
      request.confidenceScore = validationResponse.confidenceScore
      request.externalReferenceId = validationResponse.externalReferenceId

      if (!validationResponse.success) {
        request.errorMessage = validationResponse.errorMessage
      }

      const updatedRequest = await this.validationRequestRepository.save(request)

      this.logger.log(`Validation completed for request ${requestId}: ${request.result}`)
      return updatedRequest
    } catch (error) {
      this.logger.error(`Validation failed for request ${requestId}: ${error.message}`, error.stack)

      // Update request with error
      request.status = ValidationStatus.FAILED
      request.result = ValidationResult.ERROR
      request.errorMessage = error.message
      request.responsePayload = { error: error.message }

      return this.validationRequestRepository.save(request)
    }
  }

  async findAll(queryDto: QueryValidationRequestDto): Promise<{ requests: ValidationRequest[]; total: number }> {
    const { documentId, validationType, status, result, requestedBy, limit, offset } = queryDto

    const queryBuilder = this.validationRequestRepository.createQueryBuilder("validation_request")

    if (documentId) {
      queryBuilder.andWhere("validation_request.documentId = :documentId", { documentId })
    }

    if (validationType) {
      queryBuilder.andWhere("validation_request.validationType = :validationType", { validationType })
    }

    if (status) {
      queryBuilder.andWhere("validation_request.status = :status", { status })
    }

    if (result) {
      queryBuilder.andWhere("validation_request.result = :result", { result })
    }

    if (requestedBy) {
      queryBuilder.andWhere("validation_request.requestedBy = :requestedBy", { requestedBy })
    }

    queryBuilder.orderBy("validation_request.createdAt", "DESC").skip(offset).take(limit)

    const [requests, total] = await queryBuilder.getManyAndCount()

    return { requests, total }
  }

  async findOne(id: string): Promise<ValidationRequest> {
    const request = await this.validationRequestRepository.findOne({ where: { id } })

    if (!request) {
      throw new NotFoundException(`Validation request with ID ${id} not found`)
    }

    return request
  }

  async findByDocument(documentId: string): Promise<ValidationRequest[]> {
    return this.validationRequestRepository.find({
      where: { documentId },
      order: { createdAt: "DESC" },
    })
  }

  async retryValidation(requestId: string, retryDto: RetryValidationDto): Promise<ValidationRequest> {
    const request = await this.findOne(requestId)

    if (request.status === ValidationStatus.IN_PROGRESS) {
      throw new BadRequestException("Validation is already in progress")
    }

    // Update payload if provided
    if (retryDto.updatedPayload) {
      request.requestPayload = { ...request.requestPayload, ...retryDto.updatedPayload }
    }

    // Reset status and clear previous results
    request.status = ValidationStatus.PENDING
    request.result = null
    request.responsePayload = null
    request.validationDetails = null
    request.errorMessage = null
    request.validatedAt = null
    request.expiresAt = null
    request.confidenceScore = null
    request.externalReferenceId = null

    // Add retry metadata
    request.metadata = {
      ...request.metadata,
      retryCount: (request.metadata?.retryCount || 0) + 1,
      retryReason: retryDto.reason,
      retriedAt: new Date().toISOString(),
    }

    const updatedRequest = await this.validationRequestRepository.save(request)

    // Process validation asynchronously
    this.processValidationAsync(updatedRequest.id)

    return updatedRequest
  }

  async getValidationStats(): Promise<any> {
    const stats = await this.validationRequestRepository
      .createQueryBuilder("validation_request")
      .select([
        "validation_request.validationType as validationType",
        "validation_request.status as status",
        "validation_request.result as result",
        "COUNT(*) as count",
        "AVG(validation_request.confidenceScore) as avgConfidenceScore",
      ])
      .groupBy("validation_request.validationType, validation_request.status, validation_request.result")
      .getRawMany()

    return stats
  }

  async checkProviderHealth(): Promise<Record<string, boolean>> {
    const healthStatus: Record<string, boolean> = {}

    for (const [type, provider] of this.providers.entries()) {
      try {
        healthStatus[type] = await provider.healthCheck()
      } catch (error) {
        this.logger.error(`Health check failed for provider ${type}: ${error.message}`)
        healthStatus[type] = false
      }
    }

    return healthStatus
  }

  async isDocumentValidated(
    documentId: string,
  ): Promise<{ isValidated: boolean; validationResults: ValidationRequest[] }> {
    const validationResults = await this.findByDocument(documentId)

    const completedValidations = validationResults.filter(
      (v) => v.status === ValidationStatus.COMPLETED && v.result === ValidationResult.VALID,
    )

    return {
      isValidated: completedValidations.length > 0,
      validationResults,
    }
  }
}
