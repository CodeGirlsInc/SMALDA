import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccessLogsService } from './access-logs.service';
import { AccessLog } from './entities/access-log.entity';

const mockLog = {
  id: 'log-1',
  userId: 'user-1',
  routePath: '/api/documents',
  httpMethod: 'GET',
  ipAddress: '127.0.0.1',
  statusCode: 200,
  createdAt: new Date(),
};

const mockRepository = {
  create: jest.fn().mockReturnValue(mockLog),
  save: jest.fn().mockResolvedValue(mockLog),
  find: jest.fn().mockResolvedValue([mockLog]),
  findAndCount: jest.fn().mockResolvedValue([[mockLog], 1]),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(1),
    getRawOne: jest.fn().mockResolvedValue({ count: '1' }),
    getRawMany: jest.fn().mockResolvedValue([]),
  })),
};

describe('AccessLogsService', () => {
  let service: AccessLogsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessLogsService,
        {
          provide: getRepositoryToken(AccessLog),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AccessLogsService>(AccessLogsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create()', () => {
    it('should create and save an access log', async () => {
      const dto = {
        routePath: '/api/documents',
        httpMethod: 'GET',
        ipAddress: '127.0.0.1',
      };
      const result = await service.create(dto);
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: null,
        routePath: dto.routePath,
        httpMethod: dto.httpMethod,
        ipAddress: dto.ipAddress,
        statusCode: null,
      });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockLog);
    });

    it('should include userId and statusCode when provided', async () => {
      const dto = {
        userId: 'user-1',
        routePath: '/api/documents',
        httpMethod: 'POST',
        ipAddress: '10.0.0.1',
        statusCode: 201,
      };
      await service.create(dto);
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        routePath: dto.routePath,
        httpMethod: dto.httpMethod,
        ipAddress: dto.ipAddress,
        statusCode: 201,
      });
    });
  });

  describe('findAll()', () => {
    it('should return paginated results with default params', async () => {
      const result = await service.findAll({});
      expect(mockRepository.findAndCount).toHaveBeenCalled();
      expect(result.data).toEqual([mockLog]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by userId', async () => {
      await service.findAll({ userId: 'user-1' });
      const callArgs = mockRepository.findAndCount.mock.calls[0][0];
      expect(callArgs.where.userId).toBe('user-1');
    });

    it('should filter by routePath', async () => {
      await service.findAll({ routePath: '/api/documents' });
      const callArgs = mockRepository.findAndCount.mock.calls[0][0];
      expect(callArgs.where.routePath).toBe('/api/documents');
    });

    it('should filter by httpMethod', async () => {
      await service.findAll({ httpMethod: 'POST' });
      const callArgs = mockRepository.findAndCount.mock.calls[0][0];
      expect(callArgs.where.httpMethod).toBe('POST');
    });

    it('should filter by ipAddress', async () => {
      await service.findAll({ ipAddress: '127.0.0.1' });
      const callArgs = mockRepository.findAndCount.mock.calls[0][0];
      expect(callArgs.where.ipAddress).toBe('127.0.0.1');
    });

    it('should apply date range filter', async () => {
      await service.findAll({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      const callArgs = mockRepository.findAndCount.mock.calls[0][0];
      expect(callArgs.where.createdAt).toBeDefined();
    });

    it('should respect custom pagination', async () => {
      await service.findAll({ page: 2, limit: 10 });
      const callArgs = mockRepository.findAndCount.mock.calls[0][0];
      expect(callArgs.skip).toBe(10);
      expect(callArgs.take).toBe(10);
    });

    it('should sort ascending when sortByDateDesc is false', async () => {
      await service.findAll({ sortByDateDesc: false });
      const callArgs = mockRepository.findAndCount.mock.calls[0][0];
      expect(callArgs.order.createdAt).toBe('ASC');
    });
  });

  describe('findByUser()', () => {
    it('should return logs for a specific user', async () => {
      const result = await service.findByUser('user-1');
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
        take: 100,
      });
      expect(result).toEqual([mockLog]);
    });

    it('should respect custom limit', async () => {
      await service.findByUser('user-1', 50);
      const callArgs = mockRepository.find.mock.calls[0][0];
      expect(callArgs.take).toBe(50);
    });
  });

  describe('deleteOldLogs()', () => {
    it('should delete logs older than the given date', async () => {
      const olderThan = new Date('2024-01-01');
      await service.deleteOldLogs(olderThan);
      expect(mockRepository.delete).toHaveBeenCalled();
    });
  });
});
