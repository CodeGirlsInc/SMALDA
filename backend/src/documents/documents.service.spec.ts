import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DocumentsService } from './documents.service';
import { Document, DocumentStatus } from './entities/document.entity';

const mockDocument = {
  id: 'doc-123',
  ownerId: 'user-456',
  fileHash: 'abc123hash',
  status: DocumentStatus.PENDING,
  riskScore: 0,
  riskFlags: [],
};

const mockRepository = {
  create: jest.fn().mockReturnValue(mockDocument),
  save: jest.fn().mockResolvedValue(mockDocument),
  findOne: jest.fn().mockResolvedValue(mockDocument),
  find: jest.fn().mockResolvedValue([mockDocument]),
  findAndCount: jest.fn().mockResolvedValue([[mockDocument], 1]),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  createQueryBuilder: jest.fn(),
};

describe('DocumentsService', () => {
  let service: DocumentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: getRepositoryToken(Document),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────
  // Existing coverage (kept intact)
  // ───────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should persist and return document with PENDING status', async () => {
      const payload = {
        ownerId: 'user-456',
        fileHash: 'abc123hash',
        status: DocumentStatus.PENDING,
      };
      const result = await service.create(payload);
      expect(mockRepository.create).toHaveBeenCalledWith(payload);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.status).toBe(DocumentStatus.PENDING);
    });
  });

  describe('findByOwner()', () => {
    it('should return only documents belonging to specified user', async () => {
      const result = await service.findByOwner('user-456');
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { ownerId: 'user-456' },
      });
      expect(result).toEqual([mockDocument]);
      expect(result[0].ownerId).toBe('user-456');
    });
  });

  describe('findByFileHash()', () => {
    it('should return document when hash matches', async () => {
      const result = await service.findByFileHash('abc123hash');
      expect(result).toEqual(mockDocument);
    });

    it('should return null when hash not found', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);
      const result = await service.findByFileHash('nonexistent-hash');
      expect(result).toBeNull();
    });
  });

  describe('updateStatus()', () => {
    it('should correctly transition status field', async () => {
      mockRepository.findOne.mockResolvedValueOnce({
        ...mockDocument,
        status: DocumentStatus.VERIFIED,
      });
      const result = await service.updateStatus(
        'doc-123',
        DocumentStatus.VERIFIED,
      );
      expect(mockRepository.update).toHaveBeenCalledWith('doc-123', {
        status: DocumentStatus.VERIFIED,
      });
      expect(result?.status).toBe(DocumentStatus.VERIFIED);
    });
  });

  describe('updateRisk()', () => {
    it('should set riskScore and riskFlags correctly', async () => {
      const riskScore = 85;
      const riskFlags = ['high-risk', 'suspicious'];
      mockRepository.findOne.mockResolvedValueOnce({
        ...mockDocument,
        riskScore,
        riskFlags,
      });
      const result = await service.updateRisk('doc-123', riskScore, riskFlags);
      expect(mockRepository.update).toHaveBeenCalledWith('doc-123', {
        riskScore,
        riskFlags,
      });
      expect(result?.riskScore).toBe(85);
      expect(result?.riskFlags).toEqual(['high-risk', 'suspicious']);
    });
  });

  describe('delete()', () => {
    it('should remove the document record', async () => {
      await service.delete('doc-123');
      expect(mockRepository.delete).toHaveBeenCalledWith('doc-123');
    });
  });

  // ───────────────────────────────────────────────────────────
  // New coverage — gap closures
  // ───────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('should return a document by id', async () => {
      const result = await service.findById('doc-123');
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
      });
      expect(result).toEqual(mockDocument);
    });

    it('should return null when id does not exist', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);
      const result = await service.findById('nonexistent-id');
      expect(result).toBeNull();
    });
  });

  describe('findByOwnerPaginated()', () => {
    it('should return paginated results with default params', async () => {
      mockRepository.findAndCount.mockResolvedValueOnce([[mockDocument], 1]);

      const result = await service.findByOwnerPaginated('user-456', 1, 20);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerId: 'user-456' },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.data).toEqual([mockDocument]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should apply status filter when provided', async () => {
      mockRepository.findAndCount.mockResolvedValueOnce([[], 0]);

      const result = await service.findByOwnerPaginated(
        'user-456',
        2,
        10,
        DocumentStatus.VERIFIED,
      );

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerId: 'user-456', status: DocumentStatus.VERIFIED },
          skip: 10,
          take: 10,
        }),
      );
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(2);
    });

    it('should compute correct skip for page 3 with limit 5', async () => {
      mockRepository.findAndCount.mockResolvedValueOnce([[], 0]);

      await service.findByOwnerPaginated('user-456', 3, 5);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it('should order results by createdAt descending', async () => {
      mockRepository.findAndCount.mockResolvedValueOnce([[], 0]);

      await service.findByOwnerPaginated('user-456', 1, 20);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } }),
      );
    });
  });

  describe('findAllWithCoordinates()', () => {
    it('should return documents that have latitude and longitude', async () => {
      const docWithCoords = {
        ...mockDocument,
        latitude: 37.7749,
        longitude: -122.4194,
      };
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([docWithCoords]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findAllWithCoordinates();

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('document');
      expect(result).toEqual([docWithCoords]);
    });
  });

  describe('edge cases', () => {
    it('should return null when updating a non-existent document', async () => {
      mockRepository.update.mockResolvedValueOnce({ affected: 0 });
      mockRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.updateStatus(
        'nonexistent-id',
        DocumentStatus.VERIFIED,
      );
      expect(result).toBeNull();
    });

    it('should handle delete of a non-existent document without throwing', async () => {
      mockRepository.delete.mockResolvedValueOnce({ affected: 0 });
      await expect(service.delete('nonexistent-id')).resolves.toBeUndefined();
    });
  });
});
