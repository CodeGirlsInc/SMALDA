import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { createReadStream, ReadStream } from 'fs';
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
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
};

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let queueService: QueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        DocumentsService,
        { provide: getRepositoryToken(Document), useValue: mockRepository },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => (key === 'UPLOAD_DIR' ? '/uploads' : undefined) },
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
          useValue: { findLatestByDocument: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
    queueService = module.get<QueueService>(QueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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
});
