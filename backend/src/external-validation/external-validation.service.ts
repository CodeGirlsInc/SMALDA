import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ValidationRequest,
  ValidationStatus,
  ValidationResult,
  ValidationType,
} from './entities/validation-request.entity';
import {
  CreateValidationRequestDto,
  QueryValidationRequestDto,
  RetryValidationDto,
} from './dto/validation-request.dto';
import { IValidationProvider } from './interfaces/validation-provider.interface';
import { LandRegistryProvider } from './providers/land-registry.provider';
import { GovernmentIdProvider } from './providers/government-id.provider';
import { BusinessRegistrationProvider } from './providers/business-registration.provider';

@Injectable()
export class ExternalValidationService {
  private readonly logger = new Logger(ExternalValidationService.name);
  private readonly providers = new Map<ValidationType, IValidationProvider>();

  constructor(
    @InjectRepository(ValidationRequest)
    private validationRequestRepository: Repository<ValidationRequest>,
    private landRegistryProvider: LandRegistryProvider,
    private governmentIdProvider: GovernmentIdProvider,
    private businessRegistrationProvider: BusinessRegistrationProvider,
  ) {
    this.initializeProviders();
  }

  private initializeProviders() {
    this.providers.set(ValidationType.LAND_REGISTRY, this.landRegistryProvider);
    this.providers.set(ValidationType.GOVERNMENT_ID, this.governmentIdProvider);
    this.providers.set(
      ValidationType.BUSINESS_REGISTRATION,
      this.businessRegistrationProvider,
    );

    this.logger.log(`Initialized ${this.providers.size} validation providers`);
  }

  async createValidationRequest(
    createDto: CreateValidationRequestDto,
  ): Promise<ValidationRequest> {
    this.logger.log(
      `Creating validation request for document: ${createDto.documentId}`,
    );

    const provider = this.providers.get(createDto.validationType);
    if (!provider) {
      throw new BadRequestException(
        `No provider available for validation type: ${createDto.validationType}`,
      );
    }

    const validationRequest = this.validationRequestRepository.create({
      documentId: createDto.documentId,
      validationType: createDto.validationType,
      requestPayload: createDto.requestPayload,
      requestedBy: createDto.requestedBy,
      metadata: createDto.metadata,
      status: ValidationStatus.PENDING,
    });

    const savedRequest =
      await this.validationRequestRepository.save(validationRequest);

    this.processValidation(savedRequest.id);

    return savedRequest;
  }

  async processValidation(requestId: string): Promise<ValidationRequest> {
    const request = await this.validationRequestRepository.findOne({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException(`Validation request ${requestId} not found`);
    }

    if (request.status !== ValidationStatus.PENDING) {
      this.logger.warn(
        `Validation request ${requestId} is not in pending status, current status: ${request.status}`,
      );
      return request;
    }

    this.logger.log(`Processing validation request: ${requestId}`);

    request.status = ValidationStatus.IN_PROGRESS;
    await this.validationRequestRepository.save(request);

    try {
      const provider = this.providers.get(request.validationType);
      if (!provider) {
        throw new Error(
          `No provider available for validation type: ${request.validationType}`,
        );
      }

      const validationResponse = await provider.validateDocument({
        documentId: request.documentId,
        validationType: request.validationType,
        payload: request.requestPayload,
        metadata: request.metadata,
      });

      request.status = ValidationStatus.COMPLETED;
      request.result = validationResponse.result;
      request.responsePayload = validationResponse.data;
      request.validatedAt = new Date();

      if (!validationResponse.success) {
        request.errorMessage = validationResponse.errorMessage;
      }

      const updatedRequest =
        await this.validationRequestRepository.save(request);

      this.logger.log(
        `Validation completed for request ${requestId}: ${request.result}`,
      );
      return updatedRequest;
    } catch (error) {
      this.logger.error(
        `Validation failed for request ${requestId}: ${error.message}`,
        error.stack,
      );

      request.status = ValidationStatus.FAILED;
      request.result = ValidationResult.ERROR;
      request.errorMessage = error.message;
      request.responsePayload = { error: error.message };

      return this.validationRequestRepository.save(request);
    }
  }
}
