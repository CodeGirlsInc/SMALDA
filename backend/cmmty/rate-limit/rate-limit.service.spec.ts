import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  let service: RateLimitService;
  let mockRedis: jest.Mocked<Redis>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockRedis = {
      zremrangebyscore: jest.fn(),
      zcount: jest.fn(),
      zadd: jest.fn(),
      expire: jest.fn(),
      zrange: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockConfigService.get.mockReturnValue('100'); // Default rate limit

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isRateLimited', () => {
    it('should not limit when under the threshold', async () => {
      const ip = '127.0.0.1';
      const now = Date.now();

      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcount.mockResolvedValue(50); // Under limit
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await service.isRateLimited(ip);

      expect(result.limited).toBe(false);
      expect(mockRedis.zremrangebyscore).toHaveBeenCalled();
      expect(mockRedis.zcount).toHaveBeenCalled();
      expect(mockRedis.zadd).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('should limit when exceeding the threshold', async () => {
      const ip = '127.0.0.1';
      const now = Date.now();

      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcount.mockResolvedValue(100); // At limit
      mockRedis.zrange.mockResolvedValue(['timestamp', (now - 30000).toString()]);

      const result = await service.isRateLimited(ip);

      expect(result.limited).toBe(true);
      expect(result.resetTime).toBeDefined();
      expect(mockRedis.zadd).not.toHaveBeenCalled();
    });

    it('should handle custom rate limit from config', async () => {
      mockConfigService.get.mockReturnValue('50'); // Custom limit

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RateLimitService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
          {
            provide: 'REDIS_CLIENT',
            useValue: mockRedis,
          },
        ],
      }).compile();

      const customService = module.get<RateLimitService>(RateLimitService);

      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcount.mockResolvedValue(49); // Under custom limit

      const result = await customService.isRateLimited('127.0.0.1');

      expect(result.limited).toBe(false);
    });
  });

  describe('getRemainingRequests', () => {
    it('should return remaining requests', async () => {
      const ip = '127.0.0.1';

      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcount.mockResolvedValue(30);

      const remaining = await service.getRemainingRequests(ip);

      expect(remaining).toBe(70); // 100 - 30
    });

    it('should not return negative remaining requests', async () => {
      const ip = '127.0.0.1';

      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcount.mockResolvedValue(150); // Over limit

      const remaining = await service.getRemainingRequests(ip);

      expect(remaining).toBe(0);
    });
  });

  describe('getResetTime', () => {
    it('should return reset time based on oldest timestamp', async () => {
      const ip = '127.0.0.1';
      const oldestTimestamp = Date.now() - 30000;

      mockRedis.zrange.mockResolvedValue(['timestamp', oldestTimestamp.toString()]);

      const resetTime = await service.getResetTime(ip);

      expect(resetTime).toBe(oldestTimestamp + 60000); // oldest + windowMs
    });

    it('should return current time + window when no timestamps', async () => {
      const ip = '127.0.0.1';
      const now = Date.now();

      mockRedis.zrange.mockResolvedValue([]);

      const resetTime = await service.getResetTime(ip);

      expect(resetTime).toBeGreaterThanOrEqual(now + 60000);
    });
  });
});