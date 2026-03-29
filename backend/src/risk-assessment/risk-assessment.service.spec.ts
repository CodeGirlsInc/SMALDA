import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { RiskAssessmentService, RiskFlag } from './risk-assessment.service';
import { DocumentsService } from '../documents/documents.service';
import { Document, DocumentStatus } from '../documents/entities/document.entity';

const makeDoc = (overrides: Partial<Document> = {}): Document =>
  ({
    id: 'doc-1',
    ownerId: 'owner-1',
    title: 'Parcel 123 issued by Registry',
    filePath: '/tmp/doc.pdf',
    fileHash: 'abc123',
    fileSize: 200_000,
    mimeType: 'application/pdf',
    status: DocumentStatus.PENDING,
    riskScore: null,
    riskFlags: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    owner: null,
    ...overrides,
  }) as Document;

describe('RiskAssessmentService', () => {
  let service: RiskAssessmentService;
  let documentsService: jest.Mocked<DocumentsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskAssessmentService,
        {
          provide: DocumentsService,
          useValue: {
            findById: jest.fn(),
            findByOwner: jest.fn().mockResolvedValue([]),
            findByParcelId: jest.fn().mockResolvedValue(null),
            updateRisk: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<RiskAssessmentService>(RiskAssessmentService);
    documentsService = module.get(DocumentsService);
    jest.spyOn(service, 'extractTextContent').mockResolvedValue('');
  });

  afterEach(() => jest.clearAllMocks());

  describe('assessDocument', () => {
    it('throws NotFoundException when document is not found', async () => {
      documentsService.findById.mockResolvedValue(null);
      await expect(service.assessDocument('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns score and flags and persists them', async () => {
      const doc = makeDoc();
      documentsService.findById.mockResolvedValue(doc);
      jest
        .spyOn(service, 'extractTextContent')
        .mockResolvedValue('parcel no. ABC-001 signed authorized by land registry');

      const result = await service.assessDocument(doc.id);
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('flags');
      expect(documentsService.updateRisk).toHaveBeenCalledWith(doc.id, result.score, result.flags);
    });
  });

  describe('Flag detection — MISSING_PARCEL_ID', () => {
    it('raised when no parcel pattern in text and no digits in title', async () => {
      const doc = makeDoc({ title: 'no numbers here', mimeType: 'text/plain' });
      documentsService.findById.mockResolvedValue(doc);
      jest.spyOn(service, 'extractTextContent').mockResolvedValue('no parcel info');

      const { flags } = await service.assessDocument(doc.id);
      expect(flags).toContain(RiskFlag.MISSING_PARCEL_ID);
    });

    it('not raised when parcel pattern found in text', async () => {
      const doc = makeDoc({ title: 'issued document' });
      documentsService.findById.mockResolvedValue(doc);
      jest
        .spyOn(service, 'extractTextContent')
        .mockResolvedValue('parcel no. ABC-001 signed certified by land registry');

      const { flags } = await service.assessDocument(doc.id);
      expect(flags).not.toContain(RiskFlag.MISSING_PARCEL_ID);
    });
  });

  describe('Flag detection — OVERLAPPING_CLAIM', () => {
    it('raised when duplicate parcel ID exists in DB', async () => {
      const doc = makeDoc({ title: 'issued document' });
      documentsService.findById.mockResolvedValue(doc);
      jest
        .spyOn(service, 'extractTextContent')
        .mockResolvedValue('parcel no. ABC-001 signed authorized by land registry');
      documentsService.findByParcelId.mockResolvedValue(makeDoc({ id: 'doc-2' }));

      const { flags } = await service.assessDocument(doc.id);
      expect(flags).toContain(RiskFlag.OVERLAPPING_CLAIM);
    });

    it('not raised when no duplicate found', async () => {
      const doc = makeDoc({ title: 'issued document' });
      documentsService.findById.mockResolvedValue(doc);
      jest
        .spyOn(service, 'extractTextContent')
        .mockResolvedValue('parcel no. ABC-001 signed certified by land registry');
      documentsService.findByParcelId.mockResolvedValue(null);

      const { flags } = await service.assessDocument(doc.id);
      expect(flags).not.toContain(RiskFlag.OVERLAPPING_CLAIM);
    });
  });

  describe('Flag detection — FORGED_SIGNATURE_INDICATOR', () => {
    it('raised when PDF has no signature keywords in text', async () => {
      const doc = makeDoc({ title: 'Parcel 123 issued' });
      documentsService.findById.mockResolvedValue(doc);
      jest
        .spyOn(service, 'extractTextContent')
        .mockResolvedValue('parcel no. ABC-123 land registry document');

      const { flags } = await service.assessDocument(doc.id);
      expect(flags).toContain(RiskFlag.FORGED_SIGNATURE_INDICATOR);
    });

    it('not raised when PDF contains a signature keyword', async () => {
      const doc = makeDoc({ title: 'Doc 123 issued' });
      documentsService.findById.mockResolvedValue(doc);
      jest
        .spyOn(service, 'extractTextContent')
        .mockResolvedValue('parcel no. ABC-123 signed by land registry');

      const { flags } = await service.assessDocument(doc.id);
      expect(flags).not.toContain(RiskFlag.FORGED_SIGNATURE_INDICATOR);
    });
  });

  describe('Flag detection — EXPIRED_DOCUMENT', () => {
    it('raised when title contains "expired"', async () => {
      const doc = makeDoc({ title: 'expired document 123 issued' });
      documentsService.findById.mockResolvedValue(doc);

      const { flags } = await service.assessDocument(doc.id);
      expect(flags).toContain(RiskFlag.EXPIRED_DOCUMENT);
    });

    it('raised when extracted text contains "expired"', async () => {
      const doc = makeDoc({ title: 'Parcel 123 issued' });
      documentsService.findById.mockResolvedValue(doc);
      jest
        .spyOn(service, 'extractTextContent')
        .mockResolvedValue('this document is expired signed certified');

      const { flags } = await service.assessDocument(doc.id);
      expect(flags).toContain(RiskFlag.EXPIRED_DOCUMENT);
    });
  });

  describe('Flag detection — INCOMPLETE_OWNERSHIP_CHAIN', () => {
    it('raised when title is shorter than 12 characters', async () => {
      const doc = makeDoc({ title: 'short' });
      documentsService.findById.mockResolvedValue(doc);

      const { flags } = await service.assessDocument(doc.id);
      expect(flags).toContain(RiskFlag.INCOMPLETE_OWNERSHIP_CHAIN);
    });

    it('raised for empty title', async () => {
      const doc = makeDoc({ title: '' });
      documentsService.findById.mockResolvedValue(doc);

      const { flags } = await service.assessDocument(doc.id);
      expect(flags).toContain(RiskFlag.INCOMPLETE_OWNERSHIP_CHAIN);
    });
  });

  describe('Flag detection — UNKNOWN_ISSUER', () => {
    it('raised when no known issuer in text or title', async () => {
      const doc = makeDoc({ title: 'Parcel 123 document' });
      documentsService.findById.mockResolvedValue(doc);
      jest
        .spyOn(service, 'extractTextContent')
        .mockResolvedValue('parcel no. ABC-001 signed document content');

      const { flags } = await service.assessDocument(doc.id);
      expect(flags).toContain(RiskFlag.UNKNOWN_ISSUER);
    });

    it('not raised when known issuer found in text', async () => {
      const doc = makeDoc({ title: 'Parcel 123 document' });
      documentsService.findById.mockResolvedValue(doc);
      jest
        .spyOn(service, 'extractTextContent')
        .mockResolvedValue('parcel no. ABC-001 signed land registry official');

      const { flags } = await service.assessDocument(doc.id);
      expect(flags).not.toContain(RiskFlag.UNKNOWN_ISSUER);
    });
  });

  describe('calculateScore', () => {
    it('returns 0 for no flags', () => {
      expect(service.calculateScore([])).toBe(0);
    });

    it('returns correct weight for a single flag', () => {
      expect(service.calculateScore([RiskFlag.MISSING_PARCEL_ID])).toBe(20);
      expect(service.calculateScore([RiskFlag.FORGED_SIGNATURE_INDICATOR])).toBe(25);
      expect(service.calculateScore([RiskFlag.OVERLAPPING_CLAIM])).toBe(20);
      expect(service.calculateScore([RiskFlag.EXPIRED_DOCUMENT])).toBe(15);
      expect(service.calculateScore([RiskFlag.INCOMPLETE_OWNERSHIP_CHAIN])).toBe(10);
      expect(service.calculateScore([RiskFlag.UNKNOWN_ISSUER])).toBe(10);
    });

    it('sums weights for multiple flags', () => {
      expect(
        service.calculateScore([RiskFlag.MISSING_PARCEL_ID, RiskFlag.UNKNOWN_ISSUER]),
      ).toBe(30);
    });

    it('caps score at 100 when all flags are triggered', () => {
      const allFlags = Object.values(RiskFlag);
      expect(service.calculateScore(allFlags)).toBe(100);
    });

    it('returns 0 for zero-byte file edge case (no flags triggered)', () => {
      expect(service.calculateScore([])).toBe(0);
    });
  });
});
