import { Test, TestingModule } from '@nestjs/testing';
import { ActivityTrackerService } from './activity-tracker.service';
import { Activity } from './entities/activity.entity';
import { CreateActivityDto } from './dto/create-activity.dto';
import { FilterActivityDto } from './dto/filter-activity.dto';

// ---------------------------------------------------------------------------
// Mock helpers for TypeORM query builder
// ---------------------------------------------------------------------------

function createMockQueryBuilder() {
  const qb: any = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  return qb;
}

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const mockActivities: Activity[] = [
  {
    id: 'act-1',
    userId: 'user-1',
    actionType: 'LOGIN',
    timestamp: new Date('2025-01-15T10:00:00Z'),
  },
  {
    id: 'act-2',
    userId: 'user-1',
    actionType: 'UPLOAD',
    timestamp: new Date('2025-01-15T11:00:00Z'),
  },
  {
    id: 'act-3',
    userId: 'user-2',
    actionType: 'LOGIN',
    timestamp: new Date('2025-01-16T09:00:00Z'),
  },
];

const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActivityTrackerService', () => {
  let service: ActivityTrackerService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityTrackerService,
        {
          // The service uses `import type { Repository }` which is erased at
          // compile-time, so emitDecoratorMetadata emits `Function` as the
          // constructor parameter type. Provide the mock under that token.
          provide: Function,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ActivityTrackerService>(ActivityTrackerService);
  });

  // ── logActivity ──────────────────────────────────────────────────────────

  describe('logActivity()', () => {
    it('should create and save a new activity', async () => {
      const dto: CreateActivityDto = { userId: 'user-1', actionType: 'LOGIN' };
      const createdActivity = {
        id: 'new-id',
        ...dto,
        timestamp: new Date(),
      };

      mockRepository.create.mockReturnValue(createdActivity);
      mockRepository.save.mockResolvedValue(createdActivity);

      const result = await service.logActivity(dto);

      expect(mockRepository.create).toHaveBeenCalledWith(dto);
      expect(mockRepository.save).toHaveBeenCalledWith(createdActivity);
      expect(result).toEqual(createdActivity);
    });

    it('should return the saved entity from the repository', async () => {
      const dto: CreateActivityDto = {
        userId: 'user-2',
        actionType: 'UPLOAD',
      };
      const saved = { id: 'saved-id', ...dto, timestamp: new Date() };

      mockRepository.create.mockReturnValue(saved);
      mockRepository.save.mockResolvedValue(saved);

      const result = await service.logActivity(dto);
      expect(result.id).toBe('saved-id');
    });
  });

  // ── findActivities (filtered + paginated) ────────────────────────────────

  describe('findActivities()', () => {
    it('should return data and total from the query builder', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([mockActivities, 3]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const filterDto: FilterActivityDto = {};
      const result = await service.findActivities(filterDto);

      expect(result.data).toEqual(mockActivities);
      expect(result.total).toBe(3);
    });

    it('should apply userId filter when provided', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([mockActivities.slice(0, 2), 2]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const filterDto: FilterActivityDto = { userId: 'user-1' };
      await service.findActivities(filterDto);

      expect(qb.andWhere).toHaveBeenCalledWith('activity.userId = :userId', {
        userId: 'user-1',
      });
    });

    it('should apply actionType filter when provided', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const filterDto: FilterActivityDto = { actionType: 'UPLOAD' };
      await service.findActivities(filterDto);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'activity.actionType = :actionType',
        { actionType: 'UPLOAD' },
      );
    });

    it('should apply startDate filter when provided', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const filterDto: FilterActivityDto = {
        startDate: '2025-01-15T00:00:00Z',
      };
      await service.findActivities(filterDto);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'activity.timestamp >= :startDate',
        { startDate: new Date('2025-01-15T00:00:00Z') },
      );
    });

    it('should apply endDate filter when provided', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const filterDto: FilterActivityDto = {
        endDate: '2025-01-16T23:59:59Z',
      };
      await service.findActivities(filterDto);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'activity.timestamp <= :endDate',
        { endDate: new Date('2025-01-16T23:59:59Z') },
      );
    });

    it('should apply both date range filters simultaneously', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const filterDto: FilterActivityDto = {
        startDate: '2025-01-15T00:00:00Z',
        endDate: '2025-01-16T23:59:59Z',
      };
      await service.findActivities(filterDto);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'activity.timestamp >= :startDate',
        expect.any(Object),
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'activity.timestamp <= :endDate',
        expect.any(Object),
      );
    });

    it('should use default pagination (page=1, limit=10) when not specified', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const filterDto: FilterActivityDto = {};
      await service.findActivities(filterDto);

      expect(qb.skip).toHaveBeenCalledWith(0); // (1 - 1) * 10
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('should calculate correct skip for page 3 with limit 5', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const filterDto: FilterActivityDto = { page: 3, limit: 5 };
      await service.findActivities(filterDto);

      expect(qb.skip).toHaveBeenCalledWith(10); // (3 - 1) * 5
      expect(qb.take).toHaveBeenCalledWith(5);
    });

    it('should default sortBy to "timestamp" and sortOrder to DESC', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const filterDto: FilterActivityDto = {};
      await service.findActivities(filterDto);

      expect(qb.orderBy).toHaveBeenCalledWith('activity.timestamp', 'DESC');
    });

    it('should use custom sort parameters when provided', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const filterDto: FilterActivityDto = {
        sortBy: 'actionType',
        sortOrder: 'ASC',
      };
      await service.findActivities(filterDto);

      expect(qb.orderBy).toHaveBeenCalledWith('activity.actionType', 'ASC');
    });
  });

  // ── findActivitiesByUserId ───────────────────────────────────────────────

  describe('findActivitiesByUserId()', () => {
    it('should return activities for the specified user ordered by timestamp DESC', async () => {
      const userActivities = mockActivities.filter((a) => a.userId === 'user-1');
      mockRepository.find.mockResolvedValue(userActivities);

      const result = await service.findActivitiesByUserId('user-1');

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { timestamp: 'DESC' },
      });
      expect(result).toEqual(userActivities);
      expect(result.every((a) => a.userId === 'user-1')).toBe(true);
    });

    it('should return an empty array when user has no activities', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findActivitiesByUserId('nonexistent-user');

      expect(result).toEqual([]);
    });
  });

  // ── findActivitiesByActionType ───────────────────────────────────────────

  describe('findActivitiesByActionType()', () => {
    it('should return activities matching the given action type', async () => {
      const loginActivities = mockActivities.filter(
        (a) => a.actionType === 'LOGIN',
      );
      mockRepository.find.mockResolvedValue(loginActivities);

      const result = await service.findActivitiesByActionType('LOGIN');

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { actionType: 'LOGIN' },
        order: { timestamp: 'DESC' },
      });
      expect(result).toEqual(loginActivities);
      expect(result.every((a) => a.actionType === 'LOGIN')).toBe(true);
    });

    it('should return an empty array when no activities match', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findActivitiesByActionType('NONEXISTENT');

      expect(result).toEqual([]);
    });
  });
});
