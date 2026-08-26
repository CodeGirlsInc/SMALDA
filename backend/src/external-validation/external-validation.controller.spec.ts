import { Test, TestingModule } from '@nestjs/testing';
import { ExternalValidationController } from './external-validation.controller';
import { ExternalValidationService } from './external-validation.service';
import { DocumentsService } from '../documents/documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ValidationType } from './entities/validation-request.entity';
import { User } from '../users/entities/user.entity';

describe('ExternalValidationController', () => {
  let controller: ExternalValidationController;
  let validationService: ExternalValidationService;
  let documentsService: DocumentsService;

  const mockValidationService = {
    createValidationRequest: jest.fn(),
    findByDocument: jest.fn(),
  };

  const mockDocumentsService = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExternalValidationController],
      providers: [
        {
          provide: ExternalValidationService,
          useValue: mockValidationService,
        },
        {
          provide: DocumentsService,
          useValue: mockDocumentsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ExternalValidationController>(
      ExternalValidationController,
    );
    validationService = module.get<ExternalValidationService>(
      ExternalValidationService,
    );
    documentsService = module.get<DocumentsService>(DocumentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createValidation', () => {
    it('should create a validation request', async () => {
      const documentId = 'doc-1';
      const user = { id: 'user-1' } as User;
      const req = { user };
      const body = { validationType: ValidationType.LAND_REGISTRY };
      const document = { id: documentId, ownerId: user.id };

      mockDocumentsService.findById.mockResolvedValue(document);

      await controller.createValidation(documentId, body, req as any);

      expect(documentsService.findById).toHaveBeenCalledWith(documentId);
      expect(validationService.createValidationRequest).toHaveBeenCalledWith({
        documentId,
        validationType: body.validationType,
        requestedBy: user.id,
        requestPayload: undefined,
        metadata: undefined,
      });
    });
  });

  describe('getLatestValidation', () => {
    it('should return the latest validation for a document', async () => {
      const documentId = 'doc-1';
      const user = { id: 'user-1' } as User;
      const req = { user };
      const document = { id: documentId, ownerId: user.id };

      mockDocumentsService.findById.mockResolvedValue(document);
      mockValidationService.findByDocument.mockResolvedValue([
        { id: 'validation-1' },
      ]);

      const result = await controller.getLatestValidation(
        documentId,
        req as any,
      );

      expect(documentsService.findById).toHaveBeenCalledWith(documentId);
      expect(validationService.findByDocument).toHaveBeenCalledWith(documentId);
      expect(result).toEqual({ id: 'validation-1' });
    });
  });
});
