import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';

import { VerificationService } from './verification.service';
import {
  VerificationRecord,
  VerificationStatus,
} from './entities/verification-record.entity';

const mockRecord = {
  id: 'vr-1',
  documentId: 'doc-1',
  stellarTxHash: 'tx-hash-abc123',
  stellarLedger: 12345,
  anchoredAt: new Date('2025-01-01T00:00:00Z'),
  status: VerificationStatus.CONFIRMED,
  createdAt: new Date('2025-01-01T00:00:00Z'),
};

const mockRepository = {
  create: jest.fn().mockReturnValue(mockRecord),
  save: jest.fn().mockResolvedValue(mockRecord),
  find: jest.fn().mockResolvedValue([mockRecord]),
  findOne: jest.fn().mockResolvedValue(mockRecord),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
};

describe('VerificationService', () => {
  let service: VerificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        {
          provide: getRepositoryToken(VerificationRecord),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
    jest.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────
  // Record creation
  // ───────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should create and return a verification record', async () => {
      const payload = {
        documentId: 'doc-1',
        stellarTxHash: 'tx-hash-abc123',
        stellarLedger: 12345,
        status: VerificationStatus.PENDING,
      };

      const result = await service.create(payload);

      expect(mockRepository.create).toHaveBeenCalledWith(payload);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.stellarTxHash).toBe('tx-hash-abc123');
      expect(result.status).toBe(VerificationStatus.CONFIRMED);
    });

    it('should default status to PENDING when not specified', async () => {
      const pendingRecord = { ...mockRecord, status: VerificationStatus.PENDING };
      mockRepository.create.mockReturnValueOnce(pendingRecord);
      mockRepository.save.mockResolvedValueOnce(pendingRecord);

      const result = await service.create({
        documentId: 'doc-1',
        stellarTxHash: 'tx-hash-abc123',
        stellarLedger: 12345,
      });

      expect(result.status).toBe(VerificationStatus.PENDING);
    });

    it('should reject a duplicate confirmed verification for the same document', async () => {
      mockRepository.findOne.mockResolvedValueOnce({
        ...mockRecord,
        documentId: 'doc-1',
        status: VerificationStatus.CONFIRMED,
      });

      await expect(
        service.create({
          documentId: 'doc-1',
          stellarTxHash: 'tx-hash-def456',
          stellarLedger: 12346,
          status: VerificationStatus.CONFIRMED,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow a pending verification even if a confirmed one exists', async () => {
      const result = await service.create({
        documentId: 'doc-1',
        stellarTxHash: 'tx-hash-def456',
        stellarLedger: 12346,
        status: VerificationStatus.PENDING,
      });

      expect(mockRepository.findOne).not.toHaveBeenCalled();
      expect(result.documentId).toBe('doc-1');
    });
  });

  // ───────────────────────────────────────────────────────────
  // Record retrieval
  // ───────────────────────────────────────────────────────────

  describe('findByDocument()', () => {
    it('should return all verification records for a document', async () => {
      const records = [
        { ...mockRecord, id: 'vr-1' },
        { ...mockRecord, id: 'vr-2', stellarTxHash: 'tx-hash-def456' },
      ];
      mockRepository.find.mockResolvedValueOnce(records);

      const result = await service.findByDocument('doc-1');

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { documentId: 'doc-1' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('vr-1');
      expect(result[1].id).toBe('vr-2');
    });

    it('should return empty array when no records exist', async () => {
      mockRepository.find.mockResolvedValueOnce([]);

      const result = await service.findByDocument('doc-nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('findLatestByDocument()', () => {
    it('should return the most recent verification record', async () => {
      const latest = { ...mockRecord, id: 'vr-latest' };
      mockRepository.findOne.mockResolvedValueOnce(latest);

      const result = await service.findLatestByDocument('doc-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { documentId: 'doc-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result.id).toBe('vr-latest');
    });

    it('should return null when no verification record exists', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.findLatestByDocument('doc-unverified');

      expect(result).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────
  // Status updates
  // ───────────────────────────────────────────────────────────

  describe('updateStatus()', () => {
    it('should update status and return the updated record', async () => {
      const updated = { ...mockRecord, status: VerificationStatus.CONFIRMED };
      mockRepository.findOne.mockResolvedValueOnce(updated);

      const result = await service.updateStatus(
        'vr-1',
        VerificationStatus.CONFIRMED,
      );

      expect(mockRepository.update).toHaveBeenCalledWith('vr-1', {
        status: VerificationStatus.CONFIRMED,
      });
      expect(result.status).toBe(VerificationStatus.CONFIRMED);
    });

    it('should update status to FAILED', async () => {
      const failed = { ...mockRecord, status: VerificationStatus.FAILED };
      mockRepository.findOne.mockResolvedValueOnce(failed);

      const result = await service.updateStatus(
        'vr-1',
        VerificationStatus.FAILED,
      );

      expect(result.status).toBe(VerificationStatus.FAILED);
    });

    it('should return null when updating a non-existent record', async () => {
      mockRepository.update.mockResolvedValueOnce({ affected: 0 });
      mockRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.updateStatus(
        'nonexistent',
        VerificationStatus.CONFIRMED,
      );

      expect(result).toBeNull();
    });
  });
});
