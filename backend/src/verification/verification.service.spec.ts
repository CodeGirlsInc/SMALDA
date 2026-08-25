import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VerificationService } from './verification.service';
import {
  VerificationRecord,
  VerificationStatus,
} from './entities/verification-record.entity';
import { ConflictException } from '@nestjs/common';

const mockRecord = {
  id: 'v-1',
  documentId: 'doc-1',
  stellarTxHash: 'tx-hash',
  stellarLedger: 12345,
  status: VerificationStatus.CONFIRMED,
  createdAt: new Date(),
};

const mockRepository = () => ({
  create: jest.fn().mockReturnValue(mockRecord),
  save: jest.fn().mockResolvedValue(mockRecord),
  find: jest.fn().mockResolvedValue([mockRecord]),
  findOne: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
});

describe('VerificationService', () => {
  let service: VerificationService;
  let repo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    repo = mockRepository();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        {
          provide: getRepositoryToken(VerificationRecord),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create()', () => {
    it('should create a new verification record', async () => {
      const result = await service.create({
        documentId: 'doc-1',
        stellarTxHash: 'tx-hash',
        stellarLedger: 12345,
        status: VerificationStatus.PENDING,
      });
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(result.documentId).toBe('doc-1');
    });

    it('should reject duplicate confirmed verification for same document', async () => {
      repo.findOne.mockResolvedValueOnce({
        ...mockRecord,
        documentId: 'doc-1',
        status: VerificationStatus.CONFIRMED,
      });

      await expect(
        service.create({
          documentId: 'doc-1',
          stellarTxHash: 'tx-hash-2',
          stellarLedger: 12346,
          status: VerificationStatus.CONFIRMED,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow pending verification even if confirmed exists', async () => {
      const result = await service.create({
        documentId: 'doc-1',
        stellarTxHash: 'tx-hash-2',
        stellarLedger: 12346,
        status: VerificationStatus.PENDING,
      });
      expect(result.documentId).toBe('doc-1');
    });
  });

  describe('findByDocument()', () => {
    it('should return records for a document', async () => {
      const result = await service.findByDocument('doc-1');
      expect(result).toEqual([mockRecord]);
    });
  });

  describe('findLatestByDocument()', () => {
    it('should return latest record', async () => {
      repo.findOne.mockResolvedValueOnce(mockRecord);
      const result = await service.findLatestByDocument('doc-1');
      expect(result?.id).toBe('v-1');
    });

    it('should return null when no records exist', async () => {
      const result = await service.findLatestByDocument('doc-none');
      expect(result).toBeNull();
    });
  });
});
