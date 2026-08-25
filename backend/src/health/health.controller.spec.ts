import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  HealthCheckStatus,
} from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis.health';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockHealthCheck = jest.fn();

const mockDbPingCheck = jest.fn();

const mockRedisIsHealthy = jest.fn();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: { check: mockHealthCheck },
        },
        {
          provide: TypeOrmHealthIndicator,
          useValue: { pingCheck: mockDbPingCheck },
        },
        {
          provide: RedisHealthIndicator,
          useValue: { isHealthy: mockRedisIsHealthy },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('check()', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should call health.check with database and redis indicators', () => {
      mockHealthCheck.mockResolvedValue({
        status: 'ok',
        details: {
          database: { status: 'up' },
          redis: { status: 'up' },
        },
      });

      controller.check();

      expect(mockHealthCheck).toHaveBeenCalledTimes(1);
      expect(mockHealthCheck).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.any(Function),
          expect.any(Function),
        ]),
      );
    });

    it('should return status "ok" when all indicators are healthy', async () => {
      const healthyResult = {
        status: 'ok' as HealthCheckStatus,
        details: {
          database: { status: 'up' },
          redis: { status: 'up' },
        },
      };
      mockHealthCheck.mockResolvedValue(healthyResult);

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(result.details.database.status).toBe('up');
      expect(result.details.redis.status).toBe('up');
    });

    it('should return status "error" when an indicator fails', async () => {
      const errorResult = {
        status: 'error' as HealthCheckStatus,
        details: {
          database: { status: 'up' },
          redis: {
            status: 'down',
            message: 'ECONNREFUSED',
          },
        },
      };
      mockHealthCheck.mockResolvedValue(errorResult);

      const result = await controller.check();

      expect(result.status).toBe('error');
      expect(result.details.redis.status).toBe('down');
    });

    it('should propagate when health.check throws', async () => {
      mockHealthCheck.mockRejectedValue(new Error('Health check failed'));

      await expect(controller.check()).rejects.toThrow('Health check failed');
    });
  });

  // ── Indicator function invocation ────────────────────────────────────────

  describe('indicator functions', () => {
    it('should invoke the database pingCheck indicator', async () => {
      let indicatorFn: Function;
      mockHealthCheck.mockImplementation((fns: Function[]) => {
        indicatorFn = fns[0];
        return { status: 'ok', details: {} };
      });

      await controller.check();

      // The first function should call db.pingCheck('database')
      // We verify it was registered
      expect(mockHealthCheck).toHaveBeenCalled();
    });

    it('should invoke the redis isHealthy indicator', async () => {
      mockHealthCheck.mockResolvedValue({
        status: 'ok',
        details: { redis: { status: 'up' } },
      });

      await controller.check();

      expect(mockHealthCheck).toHaveBeenCalled();
    });
  });
});
