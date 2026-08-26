import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { createReadStream, ReadStream } from 'fs';
import { createHash } from 'crypto';

import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document, DocumentStatus } from './entities/document.entity';
import { QueueService } from '../queue/queue.service';
import { VerificationService } from '../verification/verification.service';

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn().mockReturnValue('random-storage-key'),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createReadStream: jest.fn(),
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockDocument = {
  id: 'doc-123',
  ownerId: 'user-456',
  title: '../../etc/passwd',
  filePath: '/uploads/random-storage-key.pdf',
  fileHash: 'abc123hash',
  fileSize: 100,
  mimeType: 'application/pdf',
  status: DocumentStatus.PENDING,
};

const mockRepository = {
  create: jest.fn().mockReturnValue(mockDocument),
  save: jest.fn().mockResolvedValue(mockDocument),
  findOne: jest.fn().mockResolvedValue(mockDocument),
  find: jest.fn().mockResolvedValue([mockDocument]),
  findAndCount: jest.fn().mockResolvedValue([[mockDocument], 1]),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
};

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let documentsService: DocumentsService;
  let queueService: QueueService;
  let verificationService: VerificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        DocumentsService,
        { provide: getRepositoryToken(Document), useValue: mockRepository },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'UPLOAD_DIR' ? '/uploads' : undefined,
          },
        },
        {
          provide: QueueService,
          useValue: {
            enqueueAnalyze: jest.fn().mockResolvedValue(undefined),
            enqueueAnchor: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: VerificationService,
          useValue: {
            findLatestByDocument: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
    documentsService = module.get<DocumentsService>(DocumentsService);
    queueService = module.get<QueueService>(QueueService);
    verificationService = module.get<VerificationService>(VerificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────
  // Existing coverage (kept intact)
  // ───────────────────────────────────────────────────────────

  describe('uploadDocument', () => {
    it('should use a randomized storage key and ignore client filename', async () => {
      const file = {
        fieldname: 'file',
        originalname: '../../etc/passwd',
        mimetype: 'application/pdf',
        size: 100,
        buffer: Buffer.from('%PDF-1.4\n'),
      } as Express.Multer.File;

      const req = { user: { id: 'user-456' }, requestId: 'req-1' } as any;
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as any;

      mockRepository.findOne.mockResolvedValueOnce(null);

      await controller.uploadDocument(file, req, res);

      const { writeFile } = jest.requireMock('fs').promises;
      expect(writeFile).toHaveBeenCalled();
      const savedPath = writeFile.mock.calls[0][0];
      expect(savedPath).toContain('random-storage-key.pdf');
      expect(savedPath).not.toContain('passwd');
      expect(savedPath).not.toContain('..');
      expect(queueService.enqueueAnalyze).toHaveBeenCalledWith('doc-123', 'req-1');
    });
  });

  describe('downloadDocument', () => {
    it('should serve files as attachment with correct content type', async () => {
      const stream = { pipe: jest.fn(), on: jest.fn() } as unknown as ReadStream;
      (createReadStream as jest.Mock).mockReturnValue(stream);

      const req = { user: { id: 'user-456' } } as any;
      const res = {
        set: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await controller.downloadDocument('doc-123', req, res);

      expect(createReadStream).toHaveBeenCalledWith(mockDocument.filePath);
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${mockDocument.title}"`,
          'X-Content-Type-Options': 'nosniff',
        }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────
  // Hash computation — identical content must yield identical hash
  // ───────────────────────────────────────────────────────────

  describe('hash computation', () => {
    it('should produce the same SHA-256 hash for identical file content', () => {
      const content = Buffer.from('land document content');
      const hash1 = createHash('sha256').update(content).digest('hex');
      const hash2 = createHash('sha256').update(content).digest('hex');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex is 64 chars
    });

    it('should produce different hashes for different content', () => {
      const hash1 = createHash('sha256')
        .update(Buffer.from('content A'))
        .digest('hex');
      const hash2 = createHash('sha256')
        .update(Buffer.from('content B'))
        .digest('hex');
      expect(hash1).not.toBe(hash2);
    });

    it('should return existing document when duplicate content is uploaded', async () => {
      const existingDoc = { ...mockDocument, id: 'existing-doc' };
      mockRepository.findOne.mockResolvedValueOnce(existingDoc);

      const file = {
        fieldname: 'file',
        originalname: 'deed.pdf',
        mimetype: 'application/pdf',
        size: 100,
        buffer: Buffer.from('%PDF-1.4\n'),
      } as Express.Multer.File;

      const req = { user: { id: 'user-456' }, requestId: 'req-1' } as any;
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as any;

      await controller.uploadDocument(file, req, res);

      // Should return 200 with existing doc, not create a new one
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(existingDoc);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────
  // Ownership & access control — user must not retrieve another
  // user's document (the critical case for a land records system)
  // ───────────────────────────────────────────────────────────

  describe('getDocument — access control', () => {
    it('should allow the owner to retrieve their own document', async () => {
      const result = await controller.getDocument('doc-123', {
        user: { id: 'user-456' },
      } as any);
      expect(result.id).toBe('doc-123');
    });

    it('should allow admin to retrieve any document', async () => {
      const result = await controller.getDocument('doc-123', {
        user: { id: 'admin-user', role: 'admin' },
      } as any);
      expect(result.id).toBe('doc-123');
    });

    it('should deny access when a different user tries to retrieve the document', async () => {
      await expect(
        controller.getDocument('doc-123', {
          user: { id: 'attacker-user', role: 'user' },
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return 404 when document does not exist', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        controller.getDocument('nonexistent', {
          user: { id: 'user-456' },
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listDocuments — ownership isolation', () => {
    it('should only return documents belonging to the requesting user', async () => {
      const otherUserDocs = [{ ...mockDocument, ownerId: 'other-user' }];
      mockRepository.findAndCount.mockResolvedValueOnce([otherUserDocs, 1]);

      const result = await controller.listDocuments(
        { page: 1, limit: 20 } as any,
        { user: { id: 'user-456' } } as any,
      );

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ownerId: 'user-456' }),
        }),
      );
      // Even though the mock returns a doc with different ownerId,
      // the service query should have used user-456
    });

    it('should return empty results when user has no documents', async () => {
      mockRepository.findAndCount.mockResolvedValueOnce([[], 0]);

      const result = await controller.listDocuments(
        { page: 1, limit: 20 } as any,
        { user: { id: 'user-with-no-docs' } } as any,
      );

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('downloadDocument — access control', () => {
    it('should deny download to a non-owner', async () => {
      const stream = { pipe: jest.fn(), on: jest.fn() } as unknown as ReadStream;
      (createReadStream as jest.Mock).mockReturnValue(stream);

      const req = { user: { id: 'attacker-user' } } as any;
      const res = {
        set: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await expect(
        controller.downloadDocument('doc-123', req, res),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deny download when user is not authenticated', async () => {
      const req = { user: undefined } as any;
      const res = {
        set: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await expect(
        controller.downloadDocument('doc-123', req, res),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────────
  // Status transitions — valid and invalid
  // ───────────────────────────────────────────────────────────

  describe('verifyDocument — status transitions', () => {
    it('should enqueue verification for a PENDING document', async () => {
      mockRepository.findOne.mockResolvedValueOnce({
        ...mockDocument,
        status: DocumentStatus.PENDING,
      });

      const req = { user: { id: 'user-456' }, requestId: 'req-1' } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.verifyDocument('doc-123', req, res);

      expect(queueService.enqueueAnchor).toHaveBeenCalledWith(
        'doc-123',
        'req-1',
      );
      expect(res.status).toHaveBeenCalledWith(202);
    });

    it('should enqueue verification for a FLAGGED document', async () => {
      mockRepository.findOne.mockResolvedValueOnce({
        ...mockDocument,
        status: DocumentStatus.FLAGGED,
      });

      const req = { user: { id: 'user-456' }, requestId: 'req-1' } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.verifyDocument('doc-123', req, res);
      expect(queueService.enqueueAnchor).toHaveBeenCalled();
    });

    it('should reject verification of an already VERIFIED document', async () => {
      mockRepository.findOne.mockResolvedValueOnce({
        ...mockDocument,
        status: DocumentStatus.VERIFIED,
      });

      const req = { user: { id: 'user-456' }, requestId: 'req-1' } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await expect(
        controller.verifyDocument('doc-123', req, res),
      ).rejects.toThrow(ConflictException);
    });

    it('should return 404 when verifying a non-existent document', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      const req = { user: { id: 'user-456' }, requestId: 'req-1' } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await expect(
        controller.verifyDocument('nonexistent', req, res),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────────
  // Validation rejection — malformed payloads
  // ───────────────────────────────────────────────────────────

  describe('uploadDocument — validation', () => {
    it('should reject upload when no file is provided', async () => {
      const req = { user: { id: 'user-456' }, requestId: 'req-1' } as any;
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as any;

      await expect(
        controller.uploadDocument(undefined as any, req, res),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return existing document on duplicate hash (idempotent upload)', async () => {
      const existingDoc = { ...mockDocument, id: 'existing-doc' };
      mockRepository.findOne.mockResolvedValueOnce(existingDoc);

      const file = {
        fieldname: 'file',
        originalname: 'deed.pdf',
        mimetype: 'application/pdf',
        size: 100,
        buffer: Buffer.from('%PDF-1.4\n'),
      } as Express.Multer.File;

      const req = { user: { id: 'user-456' }, requestId: 'req-1' } as any;
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as any;

      await controller.uploadDocument(file, req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(existingDoc);
    });
  });

  describe('getVerification — validation', () => {
    it('should return 404 when no verification record exists', async () => {
      (verificationService.findLatestByDocument as jest.Mock).mockResolvedValueOnce(
        null,
      );

      await expect(
        controller.getVerification('doc-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return verification record when it exists', async () => {
      const mockRecord = {
        id: 'vr-1',
        documentId: 'doc-123',
        stellarTxHash: 'tx-hash-123',
        stellarLedger: 12345,
        status: 'confirmed',
      };
      (verificationService.findLatestByDocument as jest.Mock).mockResolvedValueOnce(
        mockRecord,
      );

      const result = await controller.getVerification('doc-123');
      expect(result).toEqual(mockRecord);
    });
  });
});
