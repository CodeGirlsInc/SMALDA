import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { DocumentArchiveService } from './document-archive.service';
import { Document, DocumentStatus } from '../../src/documents/entities/document.entity';

describe('DocumentArchiveService', () => {
  let service: DocumentArchiveService;
  let repository: Repository<Document>;

  const mockDocument: Document = {
    id: 'doc-123',
    ownerId: 'user-123',
    owner: null,
    title: 'Test Document',
    filePath: '/path/to/file.pdf',
    fileHash: 'abc123',
    fileSize: 1024,
    mimeType: 'application/pdf',
    status: DocumentStatus.VERIFIED,
    riskScore: 0,
    riskFlags: [],
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentArchiveService,
        {
          provide: getRepositoryToken(Document),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DocumentArchiveService>(DocumentArchiveService);
    repository = module.get<Repository<Document>>(getRepositoryToken(Document));

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('archive', () => {
    it('should successfully archive a document', async () => {
      const unArchivedDocument = { ...mockDocument, archived: false };
      const archivedDocument = { ...mockDocument, archived: true };

      mockRepository.findOne
        .mockResolvedValueOnce(unArchivedDocument)
        .mockResolvedValueOnce(archivedDocument);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.archive('doc-123');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
      });
      expect(mockRepository.update).toHaveBeenCalledWith('doc-123', {
        archived: true,
      });
      expect(result).toEqual({
        id: 'doc-123',
        title: 'Test Document',
        archived: true,
        message: 'Document archived successfully',
      });
    });

    it('should return message when document is already archived', async () => {
      const archivedDocument = { ...mockDocument, archived: true };

      mockRepository.findOne.mockResolvedValue(archivedDocument);

      const result = await service.archive('doc-123');

      expect(result).toEqual({
        id: 'doc-123',
        title: 'Test Document',
        archived: true,
        message: 'Document is already archived',
      });
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when document does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.archive('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unarchive', () => {
    it('should successfully unarchive a document', async () => {
      const archivedDocument = { ...mockDocument, archived: true };
      const unarchivedDocument = { ...mockDocument, archived: false };

      mockRepository.findOne
        .mockResolvedValueOnce(archivedDocument)
        .mockResolvedValueOnce(unarchivedDocument);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.unarchive('doc-123');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
      });
      expect(mockRepository.update).toHaveBeenCalledWith('doc-123', {
        archived: false,
      });
      expect(result).toEqual({
        id: 'doc-123',
        title: 'Test Document',
        archived: false,
        message: 'Document unarchived successfully',
      });
    });

    it('should return message when document is not archived', async () => {
      const unarchivedDocument = { ...mockDocument, archived: false };

      mockRepository.findOne.mockResolvedValue(unarchivedDocument);

      const result = await service.unarchive('doc-123');

      expect(result).toEqual({
        id: 'doc-123',
        title: 'Test Document',
        archived: false,
        message: 'Document is not archived',
      });
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when document does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.unarchive('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getArchivedDocuments', () => {
    it('should return paginated archived documents', async () => {
      const archivedDoc1 = { ...mockDocument, id: 'doc-1', archived: true };
      const archivedDoc2 = { ...mockDocument, id: 'doc-2', archived: true };

      const mockQueryBuilder = {
        where: jest.fn().returnThis(),
        getCount: jest.fn().mockResolvedValue(2),
        skip: jest.fn().returnThis(),
        take: jest.fn().returnThis(),
        orderBy: jest.fn().returnThis(),
        getMany: jest.fn().mockResolvedValue([archivedDoc1, archivedDoc2]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getArchivedDocuments(1, 10);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('document');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'document.archived = :archived',
        { archived: true },
      );
      expect(mockQueryBuilder.getCount).toHaveBeenCalled();
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'document.createdAt',
        'DESC',
      );
      expect(result).toEqual({
        data: [archivedDoc1, archivedDoc2],
        total: 2,
        page: 1,
        limit: 10,
      });
    });

    it('should handle pagination correctly for page 2', async () => {
      const archivedDoc = { ...mockDocument, archived: true };

      const mockQueryBuilder = {
        where: jest.fn().returnThis(),
        getCount: jest.fn().mockResolvedValue(25),
        skip: jest.fn().returnThis(),
        take: jest.fn().returnThis(),
        orderBy: jest.fn().returnThis(),
        getMany: jest.fn().mockResolvedValue([archivedDoc]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getArchivedDocuments(2, 10);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(result.page).toBe(2);
    });

    it('should return empty list when no archived documents exist', async () => {
      const mockQueryBuilder = {
        where: jest.fn().returnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        skip: jest.fn().returnThis(),
        take: jest.fn().returnThis(),
        orderBy: jest.fn().returnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getArchivedDocuments(1, 10);

      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });
    });
  });

  describe('getNonArchivedDocuments', () => {
    it('should return paginated non-archived documents', async () => {
      const nonArchivedDoc1 = { ...mockDocument, id: 'doc-1', archived: false };
      const nonArchivedDoc2 = { ...mockDocument, id: 'doc-2', archived: false };

      const mockQueryBuilder = {
        where: jest.fn().returnThis(),
        getCount: jest.fn().mockResolvedValue(2),
        skip: jest.fn().returnThis(),
        take: jest.fn().returnThis(),
        orderBy: jest.fn().returnThis(),
        getMany: jest.fn().mockResolvedValue([nonArchivedDoc1, nonArchivedDoc2]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getNonArchivedDocuments(1, 10);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('document');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'document.archived = :archived',
        { archived: false },
      );
      expect(mockQueryBuilder.getCount).toHaveBeenCalled();
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'document.createdAt',
        'DESC',
      );
      expect(result).toEqual({
        data: [nonArchivedDoc1, nonArchivedDoc2],
        total: 2,
        page: 1,
        limit: 10,
      });
    });

    it('should return only non-archived documents', async () => {
      const nonArchivedDoc = { ...mockDocument, archived: false };

      const mockQueryBuilder = {
        where: jest.fn().returnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().returnThis(),
        take: jest.fn().returnThis(),
        orderBy: jest.fn().returnThis(),
        getMany: jest.fn().mockResolvedValue([nonArchivedDoc]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getNonArchivedDocuments(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].archived).toBe(false);
    });

    it('should return empty list when all documents are archived', async () => {
      const mockQueryBuilder = {
        where: jest.fn().returnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        skip: jest.fn().returnThis(),
        take: jest.fn().returnThis(),
        orderBy: jest.fn().returnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getNonArchivedDocuments(1, 10);

      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });
    });
  });;

  describe('state transitions', () => {
    it('should transition from unarchived to archived to unarchived', async () => {
      const unArchivedDocument = { ...mockDocument, archived: false };
      const archivedDocument = { ...mockDocument, archived: true };

      // First archive
      mockRepository.findOne
        .mockResolvedValueOnce(unArchivedDocument)
        .mockResolvedValueOnce(archivedDocument)
        // Then unarchive
        .mockResolvedValueOnce(archivedDocument)
        .mockResolvedValueOnce(unArchivedDocument);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const archiveResult = await service.archive('doc-123');
      expect(archiveResult.archived).toBe(true);

      const unarchiveResult = await service.unarchive('doc-123');
      expect(unarchiveResult.archived).toBe(false);

      expect(mockRepository.update).toHaveBeenCalledTimes(2);
      expect(mockRepository.update).toHaveBeenNthCalledWith(1, 'doc-123', {
        archived: true,
      });
      expect(mockRepository.update).toHaveBeenNthCalledWith(2, 'doc-123', {
        archived: false,
      });
    });

    it('should handle multiple consecutive archive calls idempotently', async () => {
      const unArchivedDocument = { ...mockDocument, archived: false };
      const archivedDocument = { ...mockDocument, archived: true };

      mockRepository.findOne
        .mockResolvedValueOnce(unArchivedDocument)
        .mockResolvedValueOnce(archivedDocument)
        .mockResolvedValueOnce(archivedDocument);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      // First archive
      const result1 = await service.archive('doc-123');
      expect(result1.archived).toBe(true);

      // Second archive (should be idempotent)
      const result2 = await service.archive('doc-123');
      expect(result2.archived).toBe(true);

      expect(mockRepository.update).toHaveBeenCalledTimes(1);
    });
  });
});
