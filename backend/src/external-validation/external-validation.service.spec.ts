import { Test, TestingModule } from '@nestjs/testing';
import { ExternalValidationService } from './external-validation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ValidationRequest,
  ValidationType,
  ValidationStatus,
} from './entities/validation-request.entity';
import { Repository } from 'typeorm';
import { LandRegistryProvider } from './providers/land-registry.provider';
import { GovernmentIdProvider } from './providers/government-id.provider';
import { BusinessRegistrationProvider } from './providers/business-registration.provider';
import { CreateValidationRequestDto } from './dto/validation-request.dto';

describe('ExternalValidationService', () => {
  let service: ExternalValidationService;
  let validationRequestRepo: Repository<ValidationRequest>;

  const mockValidationRequestRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockLandRegistryProvider = {
    validateDocument: jest.fn(),
    healthCheck: jest.fn(),
  };

  const mockGovernmentIdProvider = {
    validateDocument: jest.fn(),
    healthCheck: jest.fn(),
  };

  const mockBusinessRegistrationProvider = {
    validateDocument: jest.fn(),
    healthCheck: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExternalValidationService,
        {
          provide: getRepositoryToken(ValidationRequest),
          useValue: mockValidationRequestRepository,
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
    }).compile();

    service = module.get<ExternalValidationService>(ExternalValidationService);
    validationRequestRepo = module.get<Repository<ValidationRequest>>(
      getRepositoryToken(ValidationRequest),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createValidationRequest', () => {
    it('should create a validation request', async () => {
      const createDto: CreateValidationRequestDto = {
        documentId: 'doc-1',
        validationType: ValidationType.LAND_REGISTRY,
        requestPayload: {},
        requestedBy: 'user-1',
        metadata: {},
      };
      const validationRequest = {
        id: 'req-1',
        ...createDto,
        status: ValidationStatus.PENDING,
      };

      mockValidationRequestRepository.create.mockReturnValue(validationRequest);
      mockValidationRequestRepository.save.mockResolvedValue(validationRequest);

      // Mock the async processing
      jest
        .spyOn(service, 'processValidation' as any)
        .mockImplementation(async () => {});

      const result = await service.createValidationRequest(createDto);

      expect(validationRequestRepo.create).toHaveBeenCalledWith({
        ...createDto,
        status: ValidationStatus.PENDING,
      });
      expect(validationRequestRepo.save).toHaveBeenCalledWith(
        validationRequest,
      );
      expect(result).toEqual(validationRequest);
    });
  });

  describe('processValidation', () => {
    it('should process a validation and update the request to completed', async () => {
      const requestId = 'req-1';
      const request = {
        id: requestId,
        status: ValidationStatus.PENDING,
        validationType: ValidationType.LAND_REGISTRY,
        requestPayload: {},
      };
      const validationResponse = {
        result: 'VALID',
        success: true,
      };

      mockValidationRequestRepository.findOne.mockResolvedValue(request);
      mockLandRegistryProvider.validateDocument.mockResolvedValue(
        validationResponse,
      );
      mockValidationRequestRepository.save.mockImplementation((req) =>
        Promise.resolve(req),
      );

      await (service as any).processValidation(requestId);

      expect(mockValidationRequestRepository.findOne).toHaveBeenCalledWith({
        where: { id: requestId },
      });
      expect(mockLandRegistryProvider.validateDocument).toHaveBeenCalled();
      expect(mockValidationRequestRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ValidationStatus.COMPLETED,
          result: 'VALID',
        }),
      );
    });

    it('should handle provider failure and update the request to failed', async () => {
      const requestId = 'req-1';
      const request = {
        id: requestId,
        status: ValidationStatus.PENDING,
        validationType: ValidationType.LAND_REGISTRY,
        requestPayload: {},
      };
      const error = new Error('Provider failed');

      mockValidationRequestRepository.findOne.mockResolvedValue(request);
      mockLandRegistryProvider.validateDocument.mockRejectedValue(error);
      mockValidationRequestRepository.save.mockImplementation((req) =>
        Promise.resolve(req),
      );

      await (service as any).processValidation(requestId);

      expect(mockValidationRequestRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ValidationStatus.FAILED,
          errorMessage: error.message,
        }),
      );
    });
  });
});
