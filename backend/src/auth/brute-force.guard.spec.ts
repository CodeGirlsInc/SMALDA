import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const store = new Map<string, string>();

jest.mock('ioredis', () => ({
  default: jest.fn().mockImplementation(() => ({
    get: jest.fn((key: string) => Promise.resolve(store.get(key) || null)),
    setex: jest.fn((key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    incr: jest.fn((key: string) => {
      const current = parseInt(store.get(key) || '0', 10);
      store.set(key, String(current + 1));
      return Promise.resolve(current + 1);
    }),
    expire: jest.fn(() => Promise.resolve(1)),
    del: jest.fn((...keys: string[]) => {
      keys.forEach((k) => store.delete(k));
      return Promise.resolve(keys.length);
    }),
    quit: jest.fn(() => Promise.resolve('OK')),
    flushall: jest.fn(() => {
      store.clear();
      return Promise.resolve('OK');
    }),
  })),
}));

import { BruteForceGuard } from './brute-force.guard';

const mockContext = (body: any): ExecutionContext => ({
  switchToHttp: () => ({
    getRequest: () => ({ body }),
  }),
  getHandler: () => jest.fn(),
  getClass: () => jest.fn(),
} as any);

describe('BruteForceGuard', () => {
  let guard: BruteForceGuard;

  beforeEach(async () => {
    const { Test } = await import('@nestjs/testing');
    const testModule = await Test.createTestingModule({
      providers: [
        BruteForceGuard,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'REDIS_HOST') return '127.0.0.1';
              if (key === 'REDIS_PORT') return '6379';
              return undefined;
            },
          },
        },
      ],
    }).compile();

    guard = testModule.get<BruteForceGuard>(BruteForceGuard);
    await (guard as any).redis.flushall();
  });

  afterEach(async () => {
    await guard.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when no email in body', async () => {
    const result = await guard.canActivate(mockContext({}));
    expect(result).toBe(true);
  });

  it('should allow access for non-locked account', async () => {
    const result = await guard.canActivate(
      mockContext({ email: 'test@example.com' }),
    );
    expect(result).toBe(true);
  });

  it('should lock account after max failed attempts', async () => {
    const email = 'brute@example.com';
    for (let i = 0; i < 5; i++) {
      await guard.recordFailedLogin(email);
    }

    await expect(
      guard.canActivate(mockContext({ email })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should allow access for email not yet at threshold', async () => {
    const email = 'partial@example.com';
    for (let i = 0; i < 4; i++) {
      await guard.recordFailedLogin(email);
    }

    const result = await guard.canActivate(mockContext({ email }));
    expect(result).toBe(true);
  });

  it('should reset attempts after clearing', async () => {
    const email = 'reset@example.com';
    for (let i = 0; i < 3; i++) {
      await guard.recordFailedLogin(email);
    }
    await guard.resetAttempts(email);

    const result = await guard.canActivate(mockContext({ email }));
    expect(result).toBe(true);
  });
});
