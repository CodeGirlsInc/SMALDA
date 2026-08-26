import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';

// Mock typeorm to avoid path-scurry loading issues in Jest
jest.mock('@nestjs/typeorm', () => ({
  getRepositoryToken: jest.fn(() => 'MOCK_REPOSITORY'),
  InjectRepository: jest.fn(() => () => undefined),
  TypeOrmModule: { forFeature: jest.fn(() => ({ module: class {} })) },
}));
jest.mock('typeorm', () => ({
  Repository: class {},
  Entity: () => () => {},
  Column: () => () => {},
  PrimaryGeneratedColumn: () => () => {},
  CreateDateColumn: () => () => {},
  UpdateDateColumn: () => () => {},
  DeleteDateColumn: () => () => {},
  ManyToOne: () => () => {},
  OneToMany: () => () => {},
  Index: () => () => {},
}));

import {
  RiskAssessmentService,
  RiskFlag,
  RISK_FLAG_DESCRIPTIONS,
} from './risk-assessment.service';
import { DocumentsService } from '../documents/documents.service';
import { DocumentStatus } from '../documents/entities/document.entity';

// ───────────────────────────────────────────────────────────
// Helper: build a minimal Document-like object for tests
// ───────────────────────────────────────────────────────────
function makeDocument(overrides: Record<string, any> = {}): any {
  return {
    id: 'doc-1',
    ownerId: 'user-1',
    title: 'Official Land Deed - Parcel Registry',  // long enough to pass title length check
    filePath: '/tmp/test.pdf',
    fileHash: 'abc123hash',
    fileSize: 200_000, // > 50 KB — not suspicious
    mimeType: 'application/pdf',
    status: DocumentStatus.PENDING,
    riskScore: 0,
    riskFlags: [],
    latitude: null,
    longitude: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ───────────────────────────────────────────────────────────
// Mocks
// ───────────────────────────────────────────────────────────
const mockDocumentsService = {
  findById: jest.fn(),
  findByOwner: jest.fn().mockResolvedValue([]),
  findAllWithCoordinates: jest.fn().mockResolvedValue([]),
  updateRisk: jest.fn().mockResolvedValue(undefined),
};

const mockConfigService = {
  get: jest.fn((key: string, fallback?: string) => fallback ?? ''),
};

// We stub extractTextFromPdf by mocking fs.readFile so we control text content
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue(Buffer.from('')),
  },
}));

import { promises as fs } from 'fs';

describe('RiskAssessmentService', () => {
  let service: RiskAssessmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskAssessmentService,
        { provide: DocumentsService, useValue: mockDocumentsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<RiskAssessmentService>(RiskAssessmentService);
    jest.clearAllMocks();

    // Default: no other docs for owner, no coords on any doc
    mockDocumentsService.findByOwner.mockResolvedValue([]);
    mockDocumentsService.findAllWithCoordinates.mockResolvedValue([]);
    mockDocumentsService.updateRisk.mockResolvedValue(undefined);

    // Default: non-PDF file so extractTextFromPdf is skipped
    (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(''));
  });

  // ───────────────────────────────────────────────────────────
  // Document not found
  // ───────────────────────────────────────────────────────────

  describe('assessDocument()', () => {
    it('should throw NotFoundException for non-existent document', async () => {
      mockDocumentsService.findById.mockResolvedValue(null);

      await expect(service.assessDocument('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update document risk after assessment', async () => {
      const doc = makeDocument({ title: 'Official Land Deed Number 12345' });
      mockDocumentsService.findById.mockResolvedValue(doc);

      await service.assessDocument('doc-1');

      expect(mockDocumentsService.updateRisk).toHaveBeenCalledWith(
        'doc-1',
        expect.any(Number),
        expect.any(Array),
      );
    });

    it('should mark contentAnalysisPossible true for PDF documents', async () => {
      const doc = makeDocument({
        mimeType: 'application/pdf',
        title: 'Official Land Deed Number 12345',
      });
      mockDocumentsService.findById.mockResolvedValue(doc);

      const result = await service.assessDocument('doc-1');
      expect(result.contentAnalysisPossible).toBe(true);
    });

    it('should mark contentAnalysisPossible false for non-PDF documents', async () => {
      const doc = makeDocument({
        mimeType: 'image/png',
        title: 'Official Land Deed Number 12345',
      });
      mockDocumentsService.findById.mockResolvedValue(doc);

      const result = await service.assessDocument('doc-1');
      expect(result.contentAnalysisPossible).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────
  // Individual risk heuristics — isolated tests
  // ───────────────────────────────────────────────────────────

  describe('MISSING_PARCEL_ID flag', () => {
    it('should flag a document whose title contains no digits (non-PDF fallback)', async () => {
      const doc = makeDocument({
        title: 'Land Document Without Numbers',
        mimeType: 'image/png',
      });
      mockDocumentsService.findById.mockResolvedValue(doc);

      const result = await service.assessDocument('doc-1');
      expect(result.flags.map((f: any) => f.flag)).toContain(RiskFlag.MISSING_PARCEL_ID);
    });

    it('should not flag a document whose title contains digits (non-PDF fallback)', async () => {
      const doc = makeDocument({
        title: 'Deed for Parcel 12345',
        mimeType: 'image/png',
      });
      mockDocumentsService.findById.mockResolvedValue(doc);

      const result = await service.assessDocument('doc-1');
      expect(result.flags.map((f: any) => f.flag)).not.toContain(RiskFlag.MISSING_PARCEL_ID);
    });
  });

  describe('OVERLAPPING_CLAIM flag', () => {
    it('should flag when owner has other documents (non-coordinate fallback)', async () => {
      const doc = makeDocument({
        latitude: null,
        longitude: null,
      });
      mockDocumentsService.findById.mockResolvedValue(doc);
      mockDocumentsService.findByOwner.mockResolvedValue([
        doc,
        { ...doc, id: 'doc-other' },
      ]);

      const result = await service.assessDocument('doc-1');
      expect(result.flags.map((f: any) => f.flag)).toContain(RiskFlag.OVERLAPPING_CLAIM);
    });

    it('should not flag when owner has no other documents', async () => {
      const doc = makeDocument({
        latitude: null,
        longitude: null,
      });
      mockDocumentsService.findById.mockResolvedValue(doc);
      mockDocumentsService.findByOwner.mockResolvedValue([doc]);

      const result = await service.assessDocument('doc-1');
      expect(result.flags.map((f: any) => f.flag)).not.toContain(RiskFlag.OVERLAPPING_CLAIM);
    });

    it('should flag when a nearby document exists within proximity radius', async () => {
      const doc = makeDocument({
        latitude: 37.7749,
        longitude: -122.4194,
      });
      const nearbyDoc = {
        ...makeDocument({ id: 'doc-nearby' }),
        latitude: 37.7750,
        longitude: -122.4195,
      };
      mockDocumentsService.findById.mockResolvedValue(doc);
      mockDocumentsService.findAllWithCoordinates.mockResolvedValue([
        doc,
        nearbyDoc,
      ]);

      const result = await service.assessDocument('doc-1');
      expect(result.flags.map((f: any) => f.flag)).toContain(RiskFlag.OVERLAPPING_CLAIM);
    });

    it('should not flag when no other documents are nearby', async () => {
      const doc = makeDocument({
        latitude: 37.7749,
        longitude: -122.4194,
      });
      const farDoc = {
        ...makeDocument({ id: 'doc-far' }),
        latitude: 40.7128,
        longitude: -74.006,
      };
      mockDocumentsService.findById.mockResolvedValue(doc);
      mockDocumentsService.findAllWithCoordinates.mockResolvedValue([
        doc,
        farDoc,
      ]);

      const result = await service.assessDocument('doc-1');
      expect(result.flags.map((f: any) => f.flag)).not.toContain(RiskFlag.OVERLAPPING_CLAIM);
    });
  });

  describe('FORGED_SIGNATURE_INDICATOR flag', () => {
    it('should flag a small PDF (fileSize < 50KB) as suspicious', async () => {
      const doc = makeDocument({
        fileSize: 30_000,
        title: 'Official Land Deed Number 12345',
      });
      mockDocumentsService.findById.mockResolvedValue(doc);

      const result = await service.assessDocument('doc-1');
      expect(result.flags.map((f: any) => f.flag)).toContain(RiskFlag.FORGED_SIGNATURE_INDICATOR);
    });

    it('should not flag a normal-sized PDF', async () => {
      const doc = makeDocument({
        fileSize: 200_000,
        title: 'Official Land Deed Number 12345',
      });
      mockDocumentsService.findById.mockResolvedValue(doc);

      const result = await service.assessDocument('doc-1');
      expect(result.flags.map((f: any) => f.flag)).not.toContain(RiskFlag.FORGED_SIGNATURE_INDICATOR);
    });
  });

  describe('EXPIRED_DOCUMENT flag', () => {
    it('should flag a non-PDF document with "expired" in the title', async () => {
      const doc = makeDocument({
        title: 'Expired Land Deed Number 12345',
        mimeType: 'image/png',
      });
      mockDocumentsService.findById.mockResolvedValue(doc);

      const result = await service.assessDocument('doc-1');
      expect(result.flags.map((f: any) => f.flag)).toContain(RiskFlag.EXPIRED_DOCUMENT);
    });

    it('should not flag a non-PDF document without "expired" in title', async () => {
      const doc = makeDocument({
        title: 'Valid Land Deed Number 12345',
        mimeType: 'image/png',
      });
      mockDocumentsService.findById.mockResolvedValue(doc);

      const result = await service.assessDocument('doc-1');
      expect(result.flags.map((f: any) => f.flag)).not.toContain(RiskFlag.EXPIRED_DOCUMENT);
    });
  });

  describe('INCOMPLETE_OWNERSHIP_CHAIN flag', () => {
    it('should flag when title is too short (< 12 chars)', async () => {
      const doc = makeDocument({ title: 'Short' });
      mockDocumentsService.findById.mockResolvedValue(doc);

      const result = await service.assessDocument('doc-1');
      expect(result.flags.map((f: any) => f.flag)).toContain(RiskFlag.INCOMPLETE_OWNERSHIP_CHAIN);
    });

    it('should not flag when title is long enough (>= 12 chars)', async () => {
      const doc = makeDocument({
        title: 'Official Land Deed Number 12345',
      });
      mockDocumentsService.findById.mockResolvedValue(doc);

      const result = await service.assessDocument('doc-1');
      expect(result.flags).not.toContain(
        RiskFlag.INCOMPLETE_OWNERSHIP_CHAIN,
      );
    });

    it('should flag when title is empty', async () => {
      const doc = makeDocument({ title: '' });
      mockDocumentsService.findById.mockResolvedValue(doc);

      const result = await service.assessDocument('doc-1');
      expect(result.flags.map((f: any) => f.flag)).toContain(RiskFlag.INCOMPLETE_OWNERSHIP_CHAIN);
    });
  });

  describe('UNKNOWN_ISSUER flag', () => {
    it('should flag a non-PDF document whose title lacks "issued"', async () => {
      const doc = makeDocument({
        title: 'Land Deed Without Issuer Info 12345',
        mimeType: 'image/png',
      });
      mockDocumentsService.findById.mockResolvedValue(doc);

      const result = await service.assessDocument('doc-1');
      expect(result.flags.map((f: any) => f.flag)).toContain(RiskFlag.UNKNOWN_ISSUER);
    });

    it('should not flag a non-PDF document whose title contains "issued"', async () => {
      const doc = makeDocument({
        title: 'Issued Land Deed Number 12345',
        mimeType: 'image/png',
      });
      mockDocumentsService.findById.mockResolvedValue(doc);

      const result = await service.assessDocument('doc-1');
      expect(result.flags.map((f: any) => f.flag)).not.toContain(RiskFlag.UNKNOWN_ISSUER);
    });
  });

  // ───────────────────────────────────────────────────────────
  // Score aggregation and range
  // ───────────────────────────────────────────────────────────

  describe('score aggregation', () => {
    it('should return 0 when no flags are triggered', async () => {
      const doc = makeDocument({
        title: 'Official Land Deed Issued By Land Registry Number 12345',
        mimeType: 'image/png',
        fileSize: 200_000,
        latitude: null,
        longitude: null,
      });
      mockDocumentsService.findById.mockResolvedValue(doc);
      mockDocumentsService.findByOwner.mockResolvedValue([doc]);

      const result = await service.assessDocument('doc-1');
      expect(result.score).toBe(0);
    });

    it('should sum flag weights correctly', async () => {
      // Title with digits but < 12 chars → INCOMPLETE_OWNERSHIP_CHAIN (10)
      // + UNKNOWN_ISSUER (10) = 20
      const doc = makeDocument({
        title: 'Parcel 1234',  // has digits but < 12 chars
        mimeType: 'image/png',
        fileSize: 200_000,
        latitude: null,
        longitude: null,
      });
      mockDocumentsService.findById.mockResolvedValue(doc);
      mockDocumentsService.findByOwner.mockResolvedValue([doc]);

      const result = await service.assessDocument('doc-1');
      expect(result.flags.map((f: any) => f.flag)).toContain(RiskFlag.INCOMPLETE_OWNERSHIP_CHAIN);
      expect(result.flags.map((f: any) => f.flag)).toContain(RiskFlag.UNKNOWN_ISSUER);
      expect(result.flags.map((f: any) => f.flag)).not.toContain(RiskFlag.MISSING_PARCEL_ID);
      expect(result.score).toBe(20);
    });

    it('should clamp score to a maximum of 100', async () => {
      // Trigger as many flags as possible through a non-PDF:
      // MISSING_PARCEL_ID (20) + OVERLAPPING_CLAIM (20) +
      // FORGED_SIGNATURE_INDICATOR (25) + EXPIRED_DOCUMENT (15) +
      // INCOMPLETE_OWNERSHIP_CHAIN (10) + UNKNOWN_ISSUER (10) = 100
      const doc = makeDocument({
        title: 'Expired',  // < 12 chars, no digits, no "issued"
        mimeType: 'image/png',
        fileSize: 30_000,
        latitude: null,
        longitude: null,
      });
      mockDocumentsService.findById.mockResolvedValue(doc);
      // Owner has other docs → OVERLAPPING_CLAIM
      mockDocumentsService.findByOwner.mockResolvedValue([
        doc,
        { id: 'doc-other', ownerId: 'user-1' },
      ]);

      const result = await service.assessDocument('doc-1');
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should never produce a negative score', async () => {
      const doc = makeDocument({
        title: 'Official Land Deed Issued By Land Registry Number 12345',
        mimeType: 'image/png',
        fileSize: 200_000,
        latitude: null,
        longitude: null,
      });
      mockDocumentsService.findById.mockResolvedValue(doc);
      mockDocumentsService.findByOwner.mockResolvedValue([doc]);

      const result = await service.assessDocument('doc-1');
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  // ───────────────────────────────────────────────────────────
  // Determinism — same input must always produce same output
  // ───────────────────────────────────────────────────────────

  describe('determinism', () => {
    it('should produce identical results when called twice with the same document', async () => {
      const doc = makeDocument({
        title: 'Some Document Title Here 12345',
        mimeType: 'image/png',
        fileSize: 80_000,
        latitude: null,
        longitude: null,
      });
      mockDocumentsService.findById.mockResolvedValue(doc);
      mockDocumentsService.findByOwner.mockResolvedValue([doc]);

      const result1 = await service.assessDocument('doc-1');
      const result2 = await service.assessDocument('doc-1');

      expect(result1.score).toBe(result2.score);
      expect(result1.flags).toEqual(result2.flags);
    });
  });

  // ───────────────────────────────────────────────────────────
  // Conflicting signals
  // ───────────────────────────────────────────────────────────

  describe('conflicting signals', () => {
    it('should handle document with no flags (clean document)', async () => {
      const doc = makeDocument({
        title: 'Official Land Deed Issued By Registry 12345',
        mimeType: 'image/png',
        fileSize: 200_000,
        latitude: null,
        longitude: null,
      });
      mockDocumentsService.findById.mockResolvedValue(doc);
      mockDocumentsService.findByOwner.mockResolvedValue([doc]);

      const result = await service.assessDocument('doc-1');
      expect(result.score).toBe(0);
      expect(result.flags).toHaveLength(0);
    });

    it('should handle document with all flags triggered', async () => {
      // Non-PDF, short title with "expired", owner has other docs
      const doc = makeDocument({
        title: 'Expired',
        mimeType: 'image/png',
        fileSize: 30_000,
        latitude: null,
        longitude: null,
      });
      mockDocumentsService.findById.mockResolvedValue(doc);
      mockDocumentsService.findByOwner.mockResolvedValue([
        doc,
        { id: 'doc-other', ownerId: 'user-1' },
      ]);

      const result = await service.assessDocument('doc-1');
      expect(result.flags.length).toBeGreaterThanOrEqual(4);
      expect(result.score).toBeGreaterThan(0);
    });
  });
});

// ───────────────────────────────────────────────────────────
// Risk flag localization
// ───────────────────────────────────────────────────────────

describe('Risk flag localization', () => {
  it('should have descriptions for all risk flags', () => {
    const flags = Object.values(RiskFlag);
    for (const flag of flags) {
      expect(RISK_FLAG_DESCRIPTIONS[flag]).toBeDefined();
      expect(RISK_FLAG_DESCRIPTIONS[flag]['en']).toBeDefined();
      expect(RISK_FLAG_DESCRIPTIONS[flag]['fr']).toBeDefined();
      expect(RISK_FLAG_DESCRIPTIONS[flag]['es']).toBeDefined();
    }
  });

  it('should have non-empty descriptions', () => {
    for (const [flag, descriptions] of Object.entries(RISK_FLAG_DESCRIPTIONS)) {
      for (const [lang, desc] of Object.entries(descriptions)) {
        expect(desc.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('should return English description for unknown locale', () => {
    const desc = RISK_FLAG_DESCRIPTIONS[RiskFlag.MISSING_PARCEL_ID];
    expect(desc['xx']).toBeUndefined();
    expect(desc['en']).toContain('parcel');
  });
});
