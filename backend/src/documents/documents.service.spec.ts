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
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
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
      const result = await service.updateStatus('doc-123', DocumentStatus.VERIFIED);
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
});
