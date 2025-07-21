import { Controller, Post, Get, Param, Query, ParseUUIDPipe } from "@nestjs/common"
import type { ExternalValidationService } from "./external-validation.service"
import type {
  CreateValidationRequestDto,
  QueryValidationRequestDto,
  RetryValidationDto,
} from "./dto/validation-request.dto"

@Controller("validation")
export class ExternalValidationController {
  constructor(private readonly externalValidationService: ExternalValidationService) {}

  @Post("requests")
  async createValidationRequest(createDto: CreateValidationRequestDto) {
    const request = await this.externalValidationService.createValidationRequest(createDto)

    return {
      success: true,
      message: "Validation request created successfully",
      data: {
        id: request.id,
        documentId: request.documentId,
        validationType: request.validationType,
        status: request.status,
        createdAt: request.createdAt,
      },
    }
  }

  @Get("requests")
  async getValidationRequests(@Query() queryDto: QueryValidationRequestDto) {
    const result = await this.externalValidationService.findAll(queryDto)

    return {
      success: true,
      data: result.requests,
      pagination: {
        total: result.total,
        limit: queryDto.limit,
        offset: queryDto.offset,
        hasMore: result.total > (queryDto.offset + queryDto.limit),
      },
    }
  }

  @Get("requests/:id")
  async getValidationRequest(@Param("id", ParseUUIDPipe) id: string) {
    const request = await this.externalValidationService.findOne(id)

    return {
      success: true,
      data: request,
    }
  }

  @Post("requests/:id/process")
  async processValidation(@Param("id", ParseUUIDPipe) id: string) {
    const request = await this.externalValidationService.processValidation(id)

    return {
      success: true,
      message: "Validation processed successfully",
      data: {
        id: request.id,
        status: request.status,
        result: request.result,
        validatedAt: request.validatedAt,
      },
    }
  }

  @Post("requests/:id/retry")
  async retryValidation(@Param("id", ParseUUIDPipe) id: string, retryDto: RetryValidationDto) {
    const request = await this.externalValidationService.retryValidation(id, retryDto)

    return {
      success: true,
      message: "Validation retry initiated successfully",
      data: {
        id: request.id,
        status: request.status,
        retryCount: request.metadata?.retryCount || 1,
      },
    }
  }

  @Get("documents/:documentId")
  async getDocumentValidations(@Param("documentId") documentId: string) {
    const validations = await this.externalValidationService.findByDocument(documentId)

    return {
      success: true,
      data: validations,
    }
  }

  @Get("documents/:documentId/status")
  async getDocumentValidationStatus(@Param("documentId") documentId: string) {
    const result = await this.externalValidationService.isDocumentValidated(documentId)

    return {
      success: true,
      data: {
        documentId,
        isValidated: result.isValidated,
        validationCount: result.validationResults.length,
        completedValidations: result.validationResults.filter(v => v.status === "COMPLETED").length,
        validValidations: result.validationResults.filter(v => v.result === "VALID").length,
      },
    }
  }

  @Get("stats")
  async getValidationStats() {
    const stats = await this.externalValidationService.getValidationStats()

    return {
      success: true,
      data: stats,
    }
  }

  @Get("health")
  async getProviderHealth() {
    const health = await this.externalValidationService.checkProviderHealth()

    return {
      success: true,
      data: health,
      timestamp: new Date().toISOString(),
    }
  }
}
