import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportingService } from './reporting.service';
import { Document } from '../documents/entities/document.entity';
import { RiskIndicator } from '../risk/entities/risk-indicator.entity';
import { LandRecord } from '../land/entities/land-record.entity';
import { Workflow } from '../workflow/entities/workflow.entity';

type MockRepo<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createMockRepo = (): MockRepo => ({
  createQueryBuilder: jest.fn(),
  count: jest.fn(),
});

describe('ReportingService', () => {
  let service: ReportingService;
  let documentRepo: MockRepo;
  let riskRepo: MockRepo;
  let landRepo: MockRepo;
  let workflowRepo: MockRepo;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReportingService,
        { provide: getRepositoryToken(Document), useValue: createMockRepo() },
        { provide: getRepositoryToken(RiskIndicator), useValue: createMockRepo() },
        { provide: getRepositoryToken(LandRecord), useValue: createMockRepo() },
        { provide: getRepositoryToken(Workflow), useValue: createMockRepo() },
      ],
    }).compile();

    service = module.get(ReportingService);
    documentRepo = module.get(getRepositoryToken(Document));
    riskRepo = module.get(getRepositoryToken(RiskIndicator));
    landRepo = module.get(getRepositoryToken(LandRecord));
    workflowRepo = module.get(getRepositoryToken(Workflow));
  });

  /* -------------------------------------------------------------------------- */
  /* Document Summary Test                                                      */
  /* -------------------------------------------------------------------------- */

  it('returns document summary aggregation', async () => {
    const mockQB: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        totalUploaded: '10',
        verified: '5',
        failed: '3',
        pending: '2',
      }),
    };

    documentRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQB);

    const result = await service.getDocumentSummary(
      new Date(),
      new Date(),
    );

    expect(result.totalUploaded).toBe(10);
    expect(result.verified).toBe(5);
  });

  /* -------------------------------------------------------------------------- */
  /* Verification Trend Zero Fill Test                                          */
  /* -------------------------------------------------------------------------- */

  it('returns exact number of months including zero-filled months', async () => {
    const mockQB: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    documentRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQB);

    const result = await service.getVerificationTrend(6);

    expect(result).toHaveLength(6);
    expect(result.every((r) => r.count === 0)).toBe(true);
  });

  /* -------------------------------------------------------------------------- */
  /* System Health Test                                                         */
  /* -------------------------------------------------------------------------- */

  it('returns system health counts', async () => {
    landRepo.count = jest.fn().mockResolvedValue(100);
    documentRepo.count = jest.fn().mockResolvedValue(50);
    riskRepo.count = jest.fn().mockResolvedValue(10);
    workflowRepo.count = jest.fn().mockResolvedValue(5);

    const result = await service.getSystemHealth();

    expect(result.totalLandRecords).toBe(100);
    expect(result.totalDocuments).toBe(50);
  });
});