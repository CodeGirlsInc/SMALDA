import { Test, TestingModule } from '@nestjs/testing';
import { DocumentProcessor } from './document.processor';
import { QueueService } from './queue.service';
import { RiskAssessmentService } from '../risk-assessment/risk-assessment.service';
import { DocumentsService } from '../documents/documents.service';
import { StellarService } from '../stellar/stellar.service';
import { VerificationService } from '../verification/verification.service';
import { DocumentsGateway } from '../documents/documents.gateway';
import { ConfigService } from '@nestjs/config';
import { DocumentStatus } from '../documents/entities/document.entity';

// Mock the bullmq Worker
jest.mock('bullmq', () => ({
  ...jest.requireActual('bullmq'),
  Worker: jest.fn().mockImplementation((name, processor, options) => {
    return {
      on: jest.fn(),
      close: jest.fn(),
      name,
      processor,
      options,
    };
  }),
}));

describe('DocumentProcessor', () => {
  let processor: DocumentProcessor;
  let riskService: RiskAssessmentService;
  let documentsService: DocumentsService;
  let stellarService: StellarService;
  let verificationService: VerificationService;

  const mockQueueService = {
    getConnectionOptions: jest.fn().mockReturnValue({}),
    queueName: 'document-processing',
  };

  const mockRiskAssessmentService = {
    assessDocument: jest.fn(),
  };

  const mockDocumentsService = {
    findById: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockStellarService = {
    anchorHash: jest.fn(),
  };

  const mockVerificationService = {
    create: jest.fn(),
  };

  const mockDocumentsGateway = {
    notifyStatusChanged: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentProcessor,
        { provide: QueueService, useValue: mockQueueService },
        { provide: RiskAssessmentService, useValue: mockRiskAssessmentService },
        { provide: DocumentsService, useValue: mockDocumentsService },
        { provide: StellarService, useValue: mockStellarService },
        { provide: VerificationService, useValue: mockVerificationService },
        { provide: DocumentsGateway, useValue: mockDocumentsGateway },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'REDIS_HOST') return 'localhost';
              if (key === 'REDIS_PORT') return '6379';
              return null;
            }),
          },
        },
      ],
    }).compile();

    processor = module.get<DocumentProcessor>(DocumentProcessor);
    riskService = module.get<RiskAssessmentService>(RiskAssessmentService);
    documentsService = module.get<DocumentsService>(DocumentsService);
    stellarService = module.get<StellarService>(StellarService);
    verificationService = module.get<VerificationService>(VerificationService);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('analyze job', () => {
    it('should process an analyze job', async () => {
      const job = { name: 'analyze', data: { documentId: 'doc-1' } };
      const document = { id: 'doc-1', status: DocumentStatus.PENDING };

      mockDocumentsService.findById.mockResolvedValue(document as any);
      mockRiskAssessmentService.assessDocument.mockResolvedValue({
        score: 40,
      } as any);

      // Directly call the processor function passed to the Worker mock
      const worker = (processor as any).worker;
      await worker.processor(job);

      expect(riskService.assessDocument).toHaveBeenCalledWith('doc-1');
    });
  });

  describe('anchor job', () => {
    it('should process an anchor job', async () => {
      const job = { name: 'anchor', data: { documentId: 'doc-1' } };
      const document = {
        id: 'doc-1',
        fileHash: 'hash-123',
        status: DocumentStatus.VERIFIED,
      };

      mockDocumentsService.findById.mockResolvedValue(document as any);
      mockStellarService.anchorHash.mockResolvedValue({
        txHash: 'tx-1',
        ledger: 123,
      });

      // Directly call the processor function passed to the Worker mock
      const worker = (processor as any).worker;
      await worker.processor(job);

      expect(stellarService.anchorHash).toHaveBeenCalledWith('hash-123');
      expect(verificationService.create).toHaveBeenCalled();
    });
  });
});
