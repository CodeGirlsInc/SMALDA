import { Test, TestingModule } from '@nestjs/testing';
import { BulkUploadService, BulkUploadResult } from './bulk-upload.service';
import { DocumentsService } from '../../src/documents/documents.service';
import { QueueService } from '../../src/queue/queue.service';
import { Document, DocumentStatus } from '../../src/documents/entities/document.entity';
import { promises as fs } from 'fs';

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
  },
}));

describe('BulkUploadService', () => {
  let service: BulkUploadService;
  let documentsService: DocumentsService;
  let queueService: QueueService;
  let mockFs: jest.Mocked<typeof fs>;

  const mockDocumentsService = {
    findByFileHash: jest.fn(),
    create: jest.fn(),
  };

  const mockQueueService = {
    enqueueAnalyze: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkUploadService,
        {
          provide: DocumentsService,
          useValue: mockDocumentsService,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    service = module.get<BulkUploadService>(BulkUploadService);
    documentsService = module.get<DocumentsService>(DocumentsService);
    queueService = module.get<QueueService>(QueueService);
    mockFs = fs as jest.Mocked<typeof fs>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processBulkUpload', () => {
    const userId = 'user-123';
    const uploadDir = './uploads';

    it('should successfully process multiple files', async () => {
      const files = [
        {
          originalname: 'test1.pdf',
          buffer: Buffer.from('test content 1'),
          mimetype: 'application/pdf',
          size: 1000,
        },
        {
          originalname: 'test2.png',
          buffer: Buffer.from('test content 2'),
          mimetype: 'image/png',
          size: 2000,
        },
      ] as Express.Multer.File[];

      const mockDocument1 = {
        id: 'doc-1',
        title: 'test1.pdf',
        status: DocumentStatus.PENDING,
      } as Document;

      const mockDocument2 = {
        id: 'doc-2',
        title: 'test2.png',
        status: DocumentStatus.PENDING,
      } as Document;

      mockDocumentsService.findByFileHash.mockResolvedValue(null);
      mockDocumentsService.create
        .mockResolvedValueOnce(mockDocument1)
        .mockResolvedValueOnce(mockDocument2);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockQueueService.enqueueAnalyze.mockResolvedValue(undefined);

      const result = await service.processBulkUpload(files, userId, uploadDir);

      expect(result.succeeded).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.succeeded[0]).toEqual({
        id: 'doc-1',
        title: 'test1.pdf',
        status: DocumentStatus.PENDING,
      });
      expect(result.succeeded[1]).toEqual({
        id: 'doc-2',
        title: 'test2.png',
        status: DocumentStatus.PENDING,
      });
      expect(mockQueueService.enqueueAnalyze).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures', async () => {
      const files = [
        {
          originalname: 'valid.pdf',
          buffer: Buffer.from('valid content'),
          mimetype: 'application/pdf',
          size: 1000,
        },
        {
          originalname: 'invalid.txt',
          buffer: Buffer.from('invalid content'),
          mimetype: 'text/plain',
          size: 500,
        },
      ] as Express.Multer.File[];

      const mockDocument = {
        id: 'doc-1',
        title: 'valid.pdf',
        status: DocumentStatus.PENDING,
      } as Document;

      mockDocumentsService.findByFileHash.mockResolvedValue(null);
      mockDocumentsService.create.mockResolvedValue(mockDocument);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockQueueService.enqueueAnalyze.mockResolvedValue(undefined);

      const result = await service.processBulkUpload(files, userId, uploadDir);

      expect(result.succeeded).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.succeeded[0]).toEqual({
        id: 'doc-1',
        title: 'valid.pdf',
        status: DocumentStatus.PENDING,
      });
      expect(result.failed[0]).toEqual({
        filename: 'invalid.txt',
        error: expect.stringContaining('invalid MIME type'),
      });
    });

    it('should reject empty file array', async () => {
      await expect(
        service.processBulkUpload([], userId, uploadDir),
      ).rejects.toThrow('At least one file is required');
    });

    it('should reject too many files', async () => {
      const files = Array.from({ length: 11 }, () => ({
        originalname: 'test.pdf',
        buffer: Buffer.from('test'),
        mimetype: 'application/pdf',
        size: 1000,
      })) as Express.Multer.File[];

      await expect(
        service.processBulkUpload(files, userId, uploadDir),
      ).rejects.toThrow('Maximum 10 files allowed per batch');
    });

    it('should handle existing files by hash', async () => {
      const files = [
        {
          originalname: 'existing.pdf',
          buffer: Buffer.from('existing content'),
          mimetype: 'application/pdf',
          size: 1000,
        },
      ] as Express.Multer.File[];

      const existingDocument = {
        id: 'existing-doc',
        title: 'existing.pdf',
        status: DocumentStatus.VERIFIED,
      } as Document;

      mockDocumentsService.findByFileHash.mockResolvedValue(existingDocument);

      const result = await service.processBulkUpload(files, userId, uploadDir);

      expect(result.succeeded).toHaveLength(1);
      expect(result.succeeded[0]).toEqual({
        id: 'existing-doc',
        title: 'existing.pdf',
        status: DocumentStatus.VERIFIED,
      });
      expect(mockFs.writeFile).not.toHaveBeenCalled();
      expect(mockQueueService.enqueueAnalyze).not.toHaveBeenCalled();
    });
  });

  describe('validateBatch', () => {
    it('should pass validation for valid files', () => {
      const files = [
        {
          originalname: 'test.pdf',
          mimetype: 'application/pdf',
          size: 1000,
        },
        {
          originalname: 'test.png',
          mimetype: 'image/png',
          size: 2000,
        },
      ] as Express.Multer.File[];

      expect(() => service.validateBatch(files)).not.toThrow();
    });

    it('should reject empty batch', () => {
      expect(() => service.validateBatch([])).toThrow(
        'At least one file is required',
      );
    });

    it('should reject oversized files', () => {
      const files = [
        {
          originalname: 'large.pdf',
          mimetype: 'application/pdf',
          size: 25 * 1024 * 1024, // 25MB
        },
      ] as Express.Multer.File[];

      expect(() => service.validateBatch(files)).toThrow(
        'Files exceed maximum size of 20MB',
      );
    });

    it('should reject invalid MIME types', () => {
      const files = [
        {
          originalname: 'test.txt',
          mimetype: 'text/plain',
          size: 1000,
        },
      ] as Express.Multer.File[];

      expect(() => service.validateBatch(files)).toThrow(
        'Files have invalid MIME type',
      );
    });

    it('should reject too many files', () => {
      const files = Array(11).fill({
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1000,
      }) as Express.Multer.File[];

      expect(() => service.validateBatch(files)).toThrow(
        'Maximum 10 files allowed per batch',
      );
    });
  });

  describe('validateFile', () => {
    it('should pass validation for valid file', () => {
      const file = {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1000,
      } as Express.Multer.File;

      expect(() => (service as any).validateFile(file)).not.toThrow();
    });

    it('should reject oversized file', () => {
      const file = {
        originalname: 'large.pdf',
        mimetype: 'application/pdf',
        size: 25 * 1024 * 1024, // 25MB
      } as Express.Multer.File;

      expect(() => (service as any).validateFile(file)).toThrow(
        'File large.pdf exceeds maximum size of 20MB',
      );
    });

    it('should reject invalid MIME type', () => {
      const file = {
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 1000,
      } as Express.Multer.File;

      expect(() => (service as any).validateFile(file)).toThrow(
        'File test.txt has invalid MIME type',
      );
    });
  });
});
