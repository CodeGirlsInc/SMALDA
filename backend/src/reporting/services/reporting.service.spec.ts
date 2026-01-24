import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportingService } from './reporting.service';
import { AnalyticsService } from './analytics.service';
import { PdfExportService } from './pdf-export.service';
import { ExcelExportService } from './excel-export.service';
import { CacheService } from './cache.service';
import { Report, ReportType, ReportFormat, ReportStatus } from '../entities/report.entity';
import { ReportTemplate } from '../entities/report-template.entity';
import { StellarTransaction } from '../../stellar/entities/stellar-transaction.entity';

describe('ReportingService', () => {
  let service: ReportingService;
  let reportRepository: Repository<Report>;
  let templateRepository: Repository<ReportTemplate>;
  let transactionRepository: Repository<StellarTransaction>;

  const mockReportRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    })),
  };

  const mockTemplateRepository = {
    findOne: jest.fn(),
  };

  const mockTransactionRepository = {
    find: jest.fn().mockResolvedValue([]),
  };

  const mockAnalyticsService = {
    getDocumentAnalytics: jest.fn().mockResolvedValue({
      totalVerifications: 100,
      successfulVerifications: 95,
      failedVerifications: 5,
      successRate: 95,
      averageProcessingTime: 2.5,
      verificationsPerDay: [],
      riskTrends: [],
    }),
    getUserActivityAnalytics: jest.fn().mockResolvedValue({
      totalUsers: 50,
      activeUsers: 40,
      newUsersToday: 2,
      newUsersThisWeek: 10,
      newUsersThisMonth: 25,
      userGrowth: [],
      mostActiveUsers: [],
    }),
    getSystemAnalytics: jest.fn().mockResolvedValue({
      totalTransactions: 1000,
      transactionsToday: 50,
      transactionsThisWeek: 200,
      transactionsThisMonth: 800,
      averageTransactionFee: '0.0001',
      networkDistribution: [],
      statusDistribution: [],
      peakHours: [],
    }),
  };

  const mockPdfExportService = {
    generateDocumentVerificationReport: jest.fn().mockResolvedValue('/path/to/report.pdf'),
    generateUserActivityReport: jest.fn().mockResolvedValue('/path/to/report.pdf'),
    generateSystemAnalyticsReport: jest.fn().mockResolvedValue('/path/to/report.pdf'),
  };

  const mockExcelExportService = {
    generateDocumentVerificationExcel: jest.fn().mockResolvedValue('/path/to/report.xlsx'),
    generateUserActivityExcel: jest.fn().mockResolvedValue('/path/to/report.xlsx'),
    generateSystemAnalyticsExcel: jest.fn().mockResolvedValue('/path/to/report.xlsx'),
    generateCSV: jest.fn().mockResolvedValue('/path/to/report.csv'),
  };

  const mockCacheService = {
    wrap: jest.fn((key, fn) => fn()),
    generateCacheKey: jest.fn(() => 'cache-key'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingService,
        {
          provide: getRepositoryToken(Report),
          useValue: mockReportRepository,
        },
        {
          provide: getRepositoryToken(ReportTemplate),
          useValue: mockTemplateRepository,
        },
        {
          provide: getRepositoryToken(StellarTransaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
        {
          provide: PdfExportService,
          useValue: mockPdfExportService,
        },
        {
          provide: ExcelExportService,
          useValue: mockExcelExportService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<ReportingService>(ReportingService);
    reportRepository = module.get(getRepositoryToken(Report));
    templateRepository = module.get(getRepositoryToken(ReportTemplate));
    transactionRepository = module.get(getRepositoryToken(StellarTransaction));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateReport', () => {
    it('should generate a document verification report', async () => {
      const userId = 'user-123';
      const dto = {
        title: 'Test Report',
        type: ReportType.DOCUMENT_VERIFICATION,
        format: ReportFormat.PDF,
      };

      const mockReport = {
        id: 'report-123',
        ...dto,
        userId,
        status: ReportStatus.PENDING,
        startDate: new Date(),
        endDate: new Date(),
      };

      jest.spyOn(mockReportRepository, 'create').mockReturnValue(mockReport as any);
      jest.spyOn(mockReportRepository, 'save').mockResolvedValue(mockReport as any);

      // Mock fs.statSync
      const fs = require('fs');
      jest.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 } as any);

      const result = await service.generateReport(userId, dto as any);

      expect(result).toBeDefined();
      expect(mockReportRepository.create).toHaveBeenCalled();
      expect(mockReportRepository.save).toHaveBeenCalled();
    });

    it('should handle report generation errors', async () => {
      const userId = 'user-123';
      const dto = {
        title: 'Test Report',
        type: ReportType.DOCUMENT_VERIFICATION,
        format: ReportFormat.PDF,
      };

      const mockReport = {
        id: 'report-123',
        ...dto,
        userId,
        status: ReportStatus.PENDING,
        startDate: new Date(),
        endDate: new Date(),
      };

      jest.spyOn(mockReportRepository, 'create').mockReturnValue(mockReport as any);
      jest.spyOn(mockReportRepository, 'save').mockResolvedValue(mockReport as any);
      jest.spyOn(mockPdfExportService, 'generateDocumentVerificationReport')
        .mockRejectedValue(new Error('Export failed'));

      await expect(service.generateReport(userId, dto as any)).rejects.toThrow('Export failed');
    });
  });

  describe('findAll', () => {
    it('should return paginated reports', async () => {
      const userId = 'user-123';
      const filter = {
        page: 1,
        limit: 10,
      };

      const result = await service.findAll(userId, filter);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(mockReportRepository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a report by id', async () => {
      const userId = 'user-123';
      const reportId = 'report-123';
      const mockReport = { id: reportId, userId };

      jest.spyOn(mockReportRepository, 'findOne').mockResolvedValue(mockReport as any);

      const result = await service.findOne(userId, reportId);

      expect(result).toEqual(mockReport);
      expect(mockReportRepository.findOne).toHaveBeenCalledWith({
        where: { id: reportId, userId },
      });
    });

    it('should throw NotFoundException when report not found', async () => {
      const userId = 'user-123';
      const reportId = 'report-123';

      jest.spyOn(mockReportRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne(userId, reportId)).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete a report and its file', async () => {
      const userId = 'user-123';
      const reportId = 'report-123';
      const mockReport = {
        id: reportId,
        userId,
        filePath: '/path/to/file.pdf',
      };

      jest.spyOn(mockReportRepository, 'findOne').mockResolvedValue(mockReport as any);
      jest.spyOn(mockReportRepository, 'delete').mockResolvedValue(undefined as any);

      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'unlinkSync').mockImplementation();

      await service.delete(userId, reportId);

      expect(mockReportRepository.delete).toHaveBeenCalledWith(reportId);
    });
  });
});
