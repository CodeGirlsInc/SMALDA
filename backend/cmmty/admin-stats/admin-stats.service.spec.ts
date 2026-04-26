import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminStatsService } from './admin-stats.service';
import { User, UserRole } from '../../src/users/entities/user.entity';
import { Document, DocumentStatus } from '../../src/documents/entities/document.entity';

describe('AdminStatsService', () => {
  let service: AdminStatsService;
  let userRepository: Repository<User>;
  let documentRepository: Repository<Document>;

  const mockUserRepository = {
    count: jest.fn(),
  };

  const mockDocumentRepository = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminStatsService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Document),
          useValue: mockDocumentRepository,
        },
      ],
    }).compile();

    service = module.get<AdminStatsService>(AdminStatsService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    documentRepository = module.get<Repository<Document>>(getRepositoryToken(Document));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPlatformStats', () => {
    it('should return platform statistics with all metrics', async () => {
      // Mock user count
      mockUserRepository.count.mockResolvedValue(42);

      // Mock document count
      mockDocumentRepository.count.mockResolvedValue(100);

      // Mock documents by status
      const documentsByStatusMock = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { status: DocumentStatus.PENDING, count: '25' },
          { status: DocumentStatus.ANALYZING, count: '30' },
          { status: DocumentStatus.VERIFIED, count: '35' },
          { status: DocumentStatus.FLAGGED, count: '5' },
          { status: DocumentStatus.REJECTED, count: '5' },
        ]),
      };

      // Mock average risk score
      const averageRiskMock = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ avgRiskScore: '45.5' }),
      };

      // Mock high risk count
      const highRiskMock = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '15' }),
      };

      // Setup query builder mock to return different builders
      const queryBuilderMock = jest.fn();
      queryBuilderMock
        .mockReturnValueOnce(documentsByStatusMock)
        .mockReturnValueOnce(averageRiskMock)
        .mockReturnValueOnce(highRiskMock);

      mockDocumentRepository.createQueryBuilder.mockImplementation(queryBuilderMock);

      const result = await service.getPlatformStats();

      expect(result.totalUsers).toBe(42);
      expect(result.totalDocuments).toBe(100);
      expect(result.documentsByStatus).toHaveLength(5);
      expect(result.documentsByStatus[0]).toEqual({
        status: DocumentStatus.PENDING,
        count: 25,
      });
      expect(result.averageRiskScore).toBe(45.5);
      expect(result.highRiskCount).toBe(15);
    });

    it('should handle null average risk score', async () => {
      mockUserRepository.count.mockResolvedValue(10);
      mockDocumentRepository.count.mockResolvedValue(20);

      const documentsByStatusMock = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { status: DocumentStatus.PENDING, count: '20' },
        ]),
      };

      const averageRiskMock = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ avgRiskScore: null }),
      };

      const highRiskMock = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '0' }),
      };

      const queryBuilderMock = jest.fn();
      queryBuilderMock
        .mockReturnValueOnce(documentsByStatusMock)
        .mockReturnValueOnce(averageRiskMock)
        .mockReturnValueOnce(highRiskMock);

      mockDocumentRepository.createQueryBuilder.mockImplementation(queryBuilderMock);

      const result = await service.getPlatformStats();

      expect(result.averageRiskScore).toBeNull();
      expect(result.highRiskCount).toBe(0);
    });

    it('should count high-risk documents correctly (score > 60)', async () => {
      mockUserRepository.count.mockResolvedValue(5);
      mockDocumentRepository.count.mockResolvedValue(50);

      const documentsByStatusMock = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      const averageRiskMock = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ avgRiskScore: '55.0' }),
      };

      const highRiskMock = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '8' }),
      };

      const queryBuilderMock = jest.fn();
      queryBuilderMock
        .mockReturnValueOnce(documentsByStatusMock)
        .mockReturnValueOnce(averageRiskMock)
        .mockReturnValueOnce(highRiskMock);

      mockDocumentRepository.createQueryBuilder.mockImplementation(queryBuilderMock);

      const result = await service.getPlatformStats();

      expect(result.highRiskCount).toBe(8);
      // Verify that the where clause was called with correct threshold
      expect(highRiskMock.where).toHaveBeenCalledWith('doc.riskScore > :riskThreshold', {
        riskThreshold: 60,
      });
    });
  });
});
