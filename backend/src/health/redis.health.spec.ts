import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health';

// ---------------------------------------------------------------------------
// Mock ioredis
// ---------------------------------------------------------------------------

const mockConnect = jest.fn();
const mockPing = jest.fn();
const mockQuit = jest.fn();

jest.mock('ioredis', () => {
  const MockIORedis = jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    ping: mockPing,
    quit: mockQuit,
  }));
  return {
    __esModule: true,
    default: MockIORedis,
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const configValues: Record<string, string> = {
  REDIS_HOST: '127.0.0.1',
  REDIS_PORT: '6379',
  REDIS_PASSWORD: '',
};

function buildConfigService(overrides: Record<string, string> = configValues) {
  return {
    get: jest.fn((key: string) => overrides[key] ?? null),
  } as unknown as ConfigService;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        { provide: ConfigService, useValue: buildConfigService() },
      ],
    }).compile();

    indicator = module.get<RedisHealthIndicator>(RedisHealthIndicator);
  });

  // ── Healthy path ─────────────────────────────────────────────────────────

  describe('isHealthy() — happy path', () => {
    it('should return status "up" when Redis responds to ping', async () => {
      mockConnect.mockResolvedValue(undefined);
      mockPing.mockResolvedValue('PONG');
      mockQuit.mockResolvedValue('OK');

      const result = await indicator.isHealthy('redis');

      expect(result).toEqual({ redis: { status: 'up' } });
      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(mockPing).toHaveBeenCalledTimes(1);
      expect(mockQuit).toHaveBeenCalledTimes(1);
    });

    it('should use default host/port when config values are missing', async () => {
      const noConfigService = {
        get: jest.fn(() => null),
      } as unknown as ConfigService;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RedisHealthIndicator,
          { provide: ConfigService, useValue: noConfigService },
        ],
      }).compile();

      const noConfigIndicator = module.get<RedisHealthIndicator>(
        RedisHealthIndicator,
      );

      mockConnect.mockResolvedValue(undefined);
      mockPing.mockResolvedValue('PONG');
      mockQuit.mockResolvedValue('OK');

      const result = await noConfigIndicator.isHealthy('redis');

      expect(result).toEqual({ redis: { status: 'up' } });
    });
  });

  // ── Connection error ─────────────────────────────────────────────────────

  describe('isHealthy() — connection error', () => {
    it('should throw HealthCheckError with status "down" when connect fails', async () => {
      mockConnect.mockRejectedValue(new Error('ECONNREFUSED'));
      mockQuit.mockResolvedValue('OK');

      await expect(indicator.isHealthy('redis')).rejects.toThrow(
        HealthCheckError,
      );

      try {
        await indicator.isHealthy('redis');
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.message).toBe('Redis check failed');
        expect(error.causes).toEqual({
          redis: { status: 'down', message: 'ECONNREFUSED' },
        });
      }
    });

    it('should throw HealthCheckError when ping fails', async () => {
      mockConnect.mockResolvedValue(undefined);
      mockPing.mockRejectedValue(new Error('Connection lost'));
      mockQuit.mockResolvedValue('OK');

      await expect(indicator.isHealthy('redis')).rejects.toThrow(
        HealthCheckError,
      );

      try {
        await indicator.isHealthy('redis');
      } catch (error) {
        expect(error.causes).toEqual({
          redis: { status: 'down', message: 'Connection lost' },
        });
      }
    });

    it('should attempt to quit the Redis client even after a failure', async () => {
      mockConnect.mockRejectedValue(new Error('timeout'));
      mockQuit.mockResolvedValue('OK');

      try {
        await indicator.isHealthy('redis');
      } catch {
        // expected
      }

      expect(mockQuit).toHaveBeenCalled();
    });

    it('should not throw when quit() fails after a connection error', async () => {
      mockConnect.mockRejectedValue(new Error('ECONNREFUSED'));
      mockQuit.mockRejectedValue(new Error('already closed'));

      // Should not throw — the quit error is swallowed
      await expect(indicator.isHealthy('redis')).rejects.toThrow(
        HealthCheckError,
      );
    });
  });

  // ── Password handling ────────────────────────────────────────────────────

  describe('password configuration', () => {
    it('should pass the password to the Redis constructor when set', async () => {
      const IORedis = require('ioredis').default;

      const configWithPassword = {
        ...configValues,
        REDIS_PASSWORD: 'secret123',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RedisHealthIndicator,
          {
            provide: ConfigService,
            useValue: buildConfigService(configWithPassword),
          },
        ],
      }).compile();

      const pwdIndicator = module.get<RedisHealthIndicator>(
        RedisHealthIndicator,
      );

      mockConnect.mockResolvedValue(undefined);
      mockPing.mockResolvedValue('PONG');
      mockQuit.mockResolvedValue('OK');

      await pwdIndicator.isHealthy('redis');

      expect(IORedis).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'secret123' }),
      );
    });
  });
});
