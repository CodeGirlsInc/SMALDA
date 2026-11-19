import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ValidationRequest,
  ValidationStatus,
  ValidationResult,
  ValidationType,
} from './entities/validation-request.entity';
import { CreateValidationRequestDto } from './dto/validation-request.dto';
import {
  assertJsonPayloadSize,
  MAX_JSON_PAYLOAD_BYTES,
} from './dto/bounded-json.util';
import { IValidationProvider } from './interfaces/validation-provider.interface';
import { LandRegistryProvider } from './providers/land-registry.provider';
import { GovernmentIdProvider } from './providers/government-id.provider';
import { BusinessRegistrationProvider } from './providers/business-registration.provider';

/**
 * Raw provider errors are logged server-side only. Clients always see this
 * generic message instead of an upstream error string or stack trace.
 */
const GENERIC_FAILURE_MESSAGE =
  'External validation could not be completed; the request needs manual review';
const SENSITIVE_PAYLOAD_KEYS = new Set([
  'providerError',
  'error',
  'errorMessage',
  'upstreamError',
  'stack',
]);

function sanitizePayload(
  payload: Record<string, any> | null | undefined,
): Record<string, any> | null {
  if (!payload || typeof payload !== 'object') return null;
  const safe: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_PAYLOAD_KEYS.has(key)) continue;
    safe[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? sanitizePayload(value)
        : value;
  }
  return safe;
}

function toSafeResponse(request: ValidationRequest): ValidationRequest {
  return {
    ...request,
    responsePayload: sanitizePayload(request.responsePayload),
  } as ValidationRequest;
}

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

    try {
      assertJsonPayloadSize(createDto.requestPayload, 'requestPayload');
      assertJsonPayloadSize(createDto.metadata, 'metadata');
    } catch (error) {
      throw new PayloadTooLargeException(
        error.message || `Payload exceeds ${MAX_JSON_PAYLOAD_BYTES} bytes`,
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

    // Queue the work without blocking the request, but never leave a rejected
    // promise unhandled if the provider or the database fails.
    void this.processValidation(savedRequest.id).catch((error) => {
      this.logger.error(
        `Unhandled error while processing validation ${savedRequest.id}: ${error?.message}`,
        error?.stack,
      );
    });

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
      return toSafeResponse(request);
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

      if (!validationResponse.success) {
        this.logger.warn(
          `Provider for ${request.validationType} did not complete validation ${requestId}: ${validationResponse.errorMessage}`,
        );
        request.status = ValidationStatus.FAILED;
        request.result = ValidationResult.UNSURE;
        request.errorMessage = GENERIC_FAILURE_MESSAGE;
        request.responsePayload = { configured: false };
        request.validatedAt = null;
        return toSafeResponse(await this.validationRequestRepository.save(request));
      }

      request.status = ValidationStatus.COMPLETED;
      request.result = validationResponse.result;
      request.responsePayload = sanitizePayload(validationResponse.data);
      request.validatedAt = new Date();
      request.errorMessage = null;

      const updatedRequest =
        await this.validationRequestRepository.save(request);

      this.logger.log(
        `Validation completed for request ${requestId}: ${request.result}`,
      );
      return toSafeResponse(updatedRequest);
    } catch (error) {
      this.logger.error(
        `Validation failed for request ${requestId}: ${error?.message}`,
        error?.stack,
      );

      request.status = ValidationStatus.FAILED;
      request.result = ValidationResult.UNSURE;
      request.errorMessage = GENERIC_FAILURE_MESSAGE;
      request.responsePayload = { degraded: true };
      request.validatedAt = null;

      return toSafeResponse(await this.validationRequestRepository.save(request));
    }
  }

  async findByDocument(documentId: string): Promise<ValidationRequest[]> {
    const requests = await this.validationRequestRepository.find({
      where: { documentId },
      order: { createdAt: 'DESC' },
    });
    return requests.map(toSafeResponse);
  }

  async findById(requestId: string): Promise<ValidationRequest | null> {
    const request = await this.validationRequestRepository.findOne({
      where: { id: requestId },
    });
    return request ? toSafeResponse(request) : null;
  }
}
