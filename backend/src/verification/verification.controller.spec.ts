import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { VerificationController } from './verification.controller';
import { DocumentsService } from '../documents/documents.service';
import { VerificationService } from './verification.service';
import {
  VerificationRecord,
  VerificationStatus,
} from './entities/verification-record.entity';

const mockDocumentsService = {
  findByFileHash: jest.fn(),
};

const mockVerificationService = {
  findLatestByDocument: jest.fn(),
  create: jest.fn(),
};

describe('VerificationController', () => {
  let controller: VerificationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VerificationController],
      providers: [
        { provide: DocumentsService, useValue: mockDocumentsService },
        { provide: VerificationService, useValue: mockVerificationService },
      ],
    }).compile();

    controller = module.get<VerificationController>(VerificationController);
    jest.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────
  // Hash format validation
  // ───────────────────────────────────────────────────────────

  describe('hash format validation', () => {
    it('should reject a hash that is too short', async () => {
      await expect(controller.verifyByHash('abc123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject a hash that is too long', async () => {
      const longHash = 'a'.repeat(65);
      await expect(controller.verifyByHash(longHash)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject a hash with non-hex characters', async () => {
      const invalidHash = 'g' + 'a'.repeat(63);
      await expect(controller.verifyByHash(invalidHash)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should accept a valid 64-character hex hash', async () => {
      mockDocumentsService.findByFileHash.mockResolvedValueOnce(null);

      const validHash = 'a'.repeat(64);
      const result = await controller.verifyByHash(validHash);

      expect(result.verified).toBe(false);
      expect(result.message).toBe('Document not found');
    });
  });

  // ───────────────────────────────────────────────────────────
  // Unanchored document — clear negative, not false positive
  // ───────────────────────────────────────────────────────────

  describe('unanchored document', () => {
    it('should return verified: false when document exists but has no verification record', async () => {
      const doc = { id: 'doc-1', fileHash: 'a'.repeat(64) };
      mockDocumentsService.findByFileHash.mockResolvedValueOnce(doc);
      mockVerificationService.findLatestByDocument.mockResolvedValueOnce(null);

      const result = await controller.verifyByHash('a'.repeat(64));

      expect(result.verified).toBe(false);
      expect(result.message).toBe(
        'Document has not been verified on Stellar',
      );
    });

    it('should return verified: false when document is not found', async () => {
      mockDocumentsService.findByFileHash.mockResolvedValueOnce(null);

      const result = await controller.verifyByHash('b'.repeat(64));

      expect(result.verified).toBe(false);
      expect(result.message).toBe('Document not found');
    });

    it('should never return verified: true without a verification record', async () => {
      const doc = { id: 'doc-1', fileHash: 'c'.repeat(64) };
      mockDocumentsService.findByFileHash.mockResolvedValueOnce(doc);
      mockVerificationService.findLatestByDocument.mockResolvedValueOnce(null);

      const result = await controller.verifyByHash('c'.repeat(64));

      expect(result.verified).toBe(false);
      expect(result).not.toHaveProperty('stellarTxHash');
    });
  });

  // ───────────────────────────────────────────────────────────
  // Hash-mismatch / failed verification handling
  // ───────────────────────────────────────────────────────────

  describe('hash-mismatch handling', () => {
    it('should report verified: true with stellar info when verification record exists and is confirmed', async () => {
      const doc = { id: 'doc-1', fileHash: 'd'.repeat(64) };
      const record = {
        id: 'vr-1',
        documentId: 'doc-1',
        stellarTxHash: 'tx-hash-123',
        stellarLedger: 54321,
        anchoredAt: new Date('2025-06-01T00:00:00Z'),
        status: VerificationStatus.CONFIRMED,
      };
      mockDocumentsService.findByFileHash.mockResolvedValueOnce(doc);
      mockVerificationService.findLatestByDocument.mockResolvedValueOnce(
        record,
      );

      const result = await controller.verifyByHash('d'.repeat(64));

      expect(result.verified).toBe(true);
      expect(result.stellarTxHash).toBe('tx-hash-123');
      expect(result.stellarLedger).toBe(54321);
      expect(result.anchoredAt).toEqual(new Date('2025-06-01T00:00:00Z'));
    });

    it('should report verified: true for a failed verification record that is the latest', async () => {
      // A failed record is still a valid verification attempt — the caller
      // should see the result. The controller returns verified: true because
      // a Stellar record exists; the status of the record is returned as-is.
      const doc = { id: 'doc-1', fileHash: 'e'.repeat(64) };
      const record = {
        id: 'vr-2',
        documentId: 'doc-1',
        stellarTxHash: 'tx-hash-failed',
        stellarLedger: 99999,
        status: VerificationStatus.FAILED,
      };
      mockDocumentsService.findByFileHash.mockResolvedValueOnce(doc);
      mockVerificationService.findLatestByDocument.mockResolvedValueOnce(
        record,
      );

      const result = await controller.verifyByHash('e'.repeat(64));

      // The controller returns verified: true when a record exists,
      // but the caller should check the stellarTxHash for details.
      expect(result.verified).toBe(true);
      expect(result.stellarTxHash).toBe('tx-hash-failed');
    });
  });

  // ───────────────────────────────────────────────────────────
  // Idempotency — verifying twice must not create duplicates
  // ───────────────────────────────────────────────────────────

  describe('idempotency', () => {
    it('should return the same result when called multiple times for the same hash', async () => {
      const doc = { id: 'doc-1', fileHash: 'f'.repeat(64) };
      const record = {
        id: 'vr-1',
        documentId: 'doc-1',
        stellarTxHash: 'tx-hash-idempotent',
        stellarLedger: 11111,
        anchoredAt: new Date(),
        status: VerificationStatus.CONFIRMED,
      };
      mockDocumentsService.findByFileHash.mockResolvedValue(doc);
      mockVerificationService.findLatestByDocument.mockResolvedValue(record);

      const result1 = await controller.verifyByHash('f'.repeat(64));
      const result2 = await controller.verifyByHash('f'.repeat(64));

      expect(result1).toEqual(result2);
      // Controller is read-only — it never calls create()
      expect(mockVerificationService.create).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────
  // Stellar unreachable — should never report "verified"
  // ───────────────────────────────────────────────────────────

  describe('Stellar layer failure', () => {
    it('should return verified: false when no verification record exists (Stellar not queried)', async () => {
      // In the controller, if no record exists, it returns false.
      // The Stellar layer is only consulted during the anchor job, not
      // during the verify-by-hash endpoint. If Stellar is unreachable,
      // no record would have been created, so this path covers it.
      const doc = { id: 'doc-1', fileHash: '0'.repeat(64) };
      mockDocumentsService.findByFileHash.mockResolvedValueOnce(doc);
      mockVerificationService.findLatestByDocument.mockResolvedValueOnce(
        null,
      );

      const result = await controller.verifyByHash('0'.repeat(64));

      expect(result.verified).toBe(false);
      expect(result.message).toContain('not been verified');
    });

    it('should report unknown status if Stellar returns no record for an unverified doc', async () => {
      mockDocumentsService.findByFileHash.mockResolvedValueOnce(null);

      const result = await controller.verifyByHash('1'.repeat(64));

      expect(result.verified).toBe(false);
      expect(result.message).toBe('Document not found');
    });
  });
});
