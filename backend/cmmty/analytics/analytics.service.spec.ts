import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsService } from './analytics.service';
import { Document } from '../../src/documents/entities/document.entity';
import { User } from '../../src/users/entities/user.entity';
import { DocumentStatus } from '../../src/documents/entities/document.entity';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let documentRepository: Repository<Document>;
  let userRepository: Repository<User>;

  const mockDocumentRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockUserRepository = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(Document),
          useValue: mockDocumentRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    documentRepository = module.get<Repository<Document>>(
      getRepositoryToken(Document),
    );
    userRepository = module.get<Repository<User>>(
      getRepositoryToken(User),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAnalytics', () => {
    it('should return analytics data for 30d period by default', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(),
        getMany: jest.fn(),
      };

      mockDocumentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      mockQueryBuilder.getRawMany
        .mockResolvedValueOnce([
          { date: '2023-01-01', count: '5' },
          { date: '2023-01-02', count: '3' },
        ])
        .mockResolvedValueOnce([
          { date: '2023-01-01', count: '2' },
          { date: '2023-01-02', count: '4' },
        ]);

      mockQueryBuilder.getRawMany.mockResolvedValue([
        { date: '2023-01-01', count: '1' },
        { date: '2023-01-02', count: '2' },
      ]);

      const mockDocuments = [
        {
          id: '1',
          riskScore: 0.5,
          riskFlags: ['flag1', 'flag2'],
        },
        {
          id: '2',
          riskScore: 0.7,
          riskFlags: ['flag1'],
        },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(mockDocuments);

      const result = await service.getAnalytics('30d');

      expect(result).toHaveProperty('uploads');
      expect(result).toHaveProperty('verifications');
      expect(result).toHaveProperty('newUsers');
      expect(result).toHaveProperty('averageRiskScore');
      expect(result).toHaveProperty('topRiskFlags');
      expect(result.averageRiskScore).toBe(0.6);
    });

    it('should handle 7d period', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(),
        getMany: jest.fn(),
      };

      mockDocumentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.getAnalytics('7d');

      expect(result).toBeDefined();
      expect(result.uploads).toEqual([]);
      expect(result.verifications).toEqual([]);
      expect(result.newUsers).toEqual([]);
    });

    it('should handle 90d period', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(),
        getMany: jest.fn(),
      };

      mockDocumentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.getAnalytics('90d');

      expect(result).toBeDefined();
    });
  });

  describe('getDateRange', () => {
    it('should return correct date range for 7d', () => {
      const { startDate, endDate } = (service as any).getDateRange('7d');
      
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      expect(diffDays).toBe(7);
    });

    it('should return correct date range for 30d', () => {
      const { startDate, endDate } = (service as any).getDateRange('30d');
      
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      expect(diffDays).toBe(30);
    });

    it('should return correct date range for 90d', () => {
      const { startDate, endDate } = (service as any).getDateRange('90d');
      
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      expect(diffDays).toBe(90);
    });
  });

  describe('fillMissingDates', () => {
    it('should fill missing dates with zero counts', () => {
      const data = [
        { date: '2023-01-01', count: '5' },
        { date: '2023-01-03', count: '3' },
      ];
      
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-03');
      
      const result = (service as any).fillMissingDates(data, startDate, endDate);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ date: '2023-01-01', count: 5 });
      expect(result[1]).toEqual({ date: '2023-01-02', count: 0 });
      expect(result[2]).toEqual({ date: '2023-01-03', count: 3 });
    });

    it('should handle empty data', () => {
      const data = [];
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-02');
      
      const result = (service as any).fillMissingDates(data, startDate, endDate);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ date: '2023-01-01', count: 0 });
      expect(result[1]).toEqual({ date: '2023-01-02', count: 0 });
    });
  });

  describe('getRiskAnalytics', () => {
    it('should calculate average risk score and top flags', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      };

      mockDocumentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const mockDocuments = [
        {
          riskScore: 0.5,
          riskFlags: ['flag1', 'flag2'],
        },
        {
          riskScore: 0.7,
          riskFlags: ['flag1', 'flag3'],
        },
        {
          riskScore: 0.3,
          riskFlags: ['flag2'],
        },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(mockDocuments);

      const startDate = new Date();
      const endDate = new Date();
      
      const result = await (service as any).getRiskAnalytics(startDate, endDate);

      expect(result.averageRiskScore).toBe(0.5);
      expect(result.topRiskFlags).toHaveLength(3);
      expect(result.topRiskFlags[0]).toEqual({ flag: 'flag1', count: 2 });
      expect(result.topRiskFlags[1]).toEqual({ flag: 'flag2', count: 2 });
      expect(result.topRiskFlags[2]).toEqual({ flag: 'flag3', count: 1 });
    });

    it('should handle no documents', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      };

      mockDocumentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const startDate = new Date();
      const endDate = new Date();
      
      const result = await (service as any).getRiskAnalytics(startDate, endDate);

      expect(result.averageRiskScore).toBe(0);
      expect(result.topRiskFlags).toEqual([]);
    });
  });
});
