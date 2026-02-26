import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService, TypeOrmHealthIndicator, DiskHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';
import { SystemMetricsService } from './system-metrics.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;
  let dbHealthIndicator: TypeOrmHealthIndicator;
  let systemMetricsService: SystemMetricsService;

  const mockHealthCheckService = {
    check: jest.fn(),
  };

  const mockDbHealthIndicator = {
    pingCheck: jest.fn(),
  };

  const mockDiskHealthIndicator = {
    checkStorage: jest.fn(),
  };

  const mockMemoryHealthIndicator = {
    checkHeap: jest.fn(),
  };

  const mockSystemMetricsService = {
    getMemoryUsage: jest.fn(),
    getUptime: jest.fn(),
    getDiskUsage: jest.fn(),
    isDiskSpaceSufficient: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthCheckService,
        },
        {
          provide: TypeOrmHealthIndicator,
          useValue: mockDbHealthIndicator,
        },
        {
          provide: DiskHealthIndicator,
          useValue: mockDiskHealthIndicator,
        },
        {
          provide: MemoryHealthIndicator,
          useValue: mockMemoryHealthIndicator,
        },
        {
          provide: SystemMetricsService,
          useValue: mockSystemMetricsService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
    dbHealthIndicator = module.get<TypeOrmHealthIndicator>(TypeOrmHealthIndicator);
    systemMetricsService = module.get<SystemMetricsService>(SystemMetricsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getLiveness', () => {
    it('should return { status: "ok" }', () => {
      const result = controller.getLiveness();
      expect(result).toEqual({ status: 'ok' });
    });
  });

  describe('getReadiness', () => {
    it('should return health check result when all checks pass', async () => {
      const expectedResult = {
        status: 'ok',
        info: {
          database: { status: 'up' },
          storage: { status: 'up' },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(expectedResult);

      const result = await controller.getReadiness();
      expect(result).toEqual(expectedResult);
      expect(mockHealthCheckService.check).toHaveBeenCalled();
    });

    it('should return error when health check fails', async () => {
      const expectedResult = {
        status: 'error',
        error: {
          database: { status: 'down' },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(expectedResult);

      const result = await controller.getReadiness();
      expect(result).toEqual(expectedResult);
      expect(mockHealthCheckService.check).toHaveBeenCalled();
    });
  });

  describe('getDetailedHealth', () => {
    beforeEach(() => {
      mockSystemMetricsService.getMemoryUsage.mockReturnValue({
        heapUsed: 128,
        heapTotal: 256,
        rss: 180,
      });

      mockSystemMetricsService.getDiskUsage.mockReturnValue({
        total: 10000,
        free: 5000,
        used: 5000,
        freePercent: 50,
      });

      mockSystemMetricsService.getUptime.mockReturnValue(3600);
      mockSystemMetricsService.isDiskSpaceSufficient.mockReturnValue(true);
    });

    it('should return detailed health information when database is up', async () => {
      mockDbHealthIndicator.pingCheck.mockResolvedValue({ status: 'up' });

      const result = await controller.getDetailedHealth();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime', 3600);
      expect(result).toHaveProperty('memory');
      expect(result).toHaveProperty('disk');
      expect(result).toHaveProperty('database');

      expect(result.memory).toEqual({
        heapUsed: 128,
        heapTotal: 256,
        rss: 180,
      });

      expect(result.disk).toEqual({
        total: 10000,
        free: 5000,
        used: 5000,
        freePercent: 50,
      });

      expect(result.database).toHaveProperty('status', 'up');
      expect(result.database).toHaveProperty('responseTime');
      expect(typeof result.database.responseTime).toBe('number');
    });

    it('should return error status when database is down', async () => {
      mockDbHealthIndicator.pingCheck.mockRejectedValue(new Error('Database connection failed'));

      const result = await controller.getDetailedHealth();

      expect(result.status).toBe('error');
      expect(result.database.status).toBe('down');
      expect(result.database.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return error status when disk space is insufficient', async () => {
      mockDbHealthIndicator.pingCheck.mockResolvedValue({ status: 'up' });
      mockSystemMetricsService.isDiskSpaceSufficient.mockReturnValue(false);

      const result = await controller.getDetailedHealth();

      expect(result.status).toBe('error');
      expect(result.database.status).toBe('up');
    });

    it('should measure database response time correctly', async () => {
      // Mock a delay in database response
      mockDbHealthIndicator.pingCheck.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // 10ms delay
        return { status: 'up' };
      });

      const result = await controller.getDetailedHealth();

      expect(result.database.responseTime).toBeGreaterThanOrEqual(10);
    });
  });
});
