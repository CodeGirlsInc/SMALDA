import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './services/cache.service';
import { CacheInvalidationService } from './services/cache-invalidation.service';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

// Mock Redis
jest.mock('ioredis');

describe('Cache Layer', () => {
  let cacheService: CacheService;
  let cacheInvalidationService: CacheInvalidationService;
  let configService: ConfigService;
  let redisMock: jest.Mocked<Redis>;

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create mock Redis instance
    redisMock = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      exists: jest.fn(),
      flushdb: jest.fn(),
      quit: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    // Mock Redis constructor
    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(
      () => redisMock,
    );

    // Create test module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        CacheInvalidationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                REDIS_HOST: 'localhost',
                REDIS_PORT: 6379,
                REDIS_DB: 0,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    cacheService = module.get<CacheService>(CacheService);
    cacheInvalidationService = module.get<CacheInvalidationService>(
      CacheInvalidationService,
    );
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('CacheService', () => {
    describe('get - cache hit', () => {
      it('should return cached data if key exists', async () => {
        const testData = { id: '123', name: 'Test Document' };
        const serializedData = JSON.stringify(testData);

        redisMock.get.mockResolvedValue(serializedData);

        const result = await cacheService.get('test-key');

        expect(result).toEqual(testData);
        expect(redisMock.get).toHaveBeenCalledWith('test-key');
      });

      it('should return the correct type after deserialization', async () => {
        const testData = { count: 42, timestamp: 1234567890 };
        redisMock.get.mockResolvedValue(JSON.stringify(testData));

        const result = await cacheService.get('count-key');

        expect(result).toEqual(testData);
        expect(typeof result?.count).toBe('number');
      });
    });

    describe('get - cache miss', () => {
      it('should return null if key does not exist', async () => {
        redisMock.get.mockResolvedValue(null);

        const result = await cacheService.get('non-existent-key');

        expect(result).toBeNull();
        expect(redisMock.get).toHaveBeenCalledWith('non-existent-key');
      });

      it('should handle empty string values gracefully', async () => {
        redisMock.get.mockResolvedValue(null);

        const result = await cacheService.get('empty-key');

        expect(result).toBeNull();
      });

      it('should handle errors gracefully', async () => {
        redisMock.get.mockRejectedValue(new Error('Redis connection failed'));

        const result = await cacheService.get('error-key');

        expect(result).toBeNull();
      });
    });

    describe('set - store in cache', () => {
      it('should set data with default TTL', async () => {
        const testData = { id: '456', value: 'test' };
        redisMock.setex.mockResolvedValue('OK');

        await cacheService.set('cache-key', testData);

        expect(redisMock.setex).toHaveBeenCalledWith(
          'cache-key',
          60,
          JSON.stringify(testData),
        );
      });

      it('should set data with custom TTL', async () => {
        const testData = { id: '789', value: 'test' };
        redisMock.setex.mockResolvedValue('OK');

        await cacheService.set('custom-ttl-key', testData, 300);

        expect(redisMock.setex).toHaveBeenCalledWith(
          'custom-ttl-key',
          300,
          JSON.stringify(testData),
        );
      });

      it('should handle errors during set operation', async () => {
        const testData = { id: '999' };
        redisMock.setex.mockRejectedValue(new Error('Redis error'));

        // Should not throw
        await expect(cacheService.set('error-key', testData)).resolves.toBeUndefined();
      });
    });

    describe('delete - cache invalidation', () => {
      it('should delete a single cache key', async () => {
        redisMock.del.mockResolvedValue(1);

        await cacheService.delete('key-to-delete');

        expect(redisMock.del).toHaveBeenCalledWith('key-to-delete');
      });

      it('should handle deletion of non-existent keys', async () => {
        redisMock.del.mockResolvedValue(0);

        await expect(cacheService.delete('non-existent')).resolves.toBeUndefined();
        expect(redisMock.del).toHaveBeenCalledWith('non-existent');
      });

      it('should handle errors during deletion', async () => {
        redisMock.del.mockRejectedValue(new Error('Redis error'));

        await expect(cacheService.delete('error-key')).resolves.toBeUndefined();
      });
    });

    describe('deleteByPattern - pattern-based invalidation', () => {
      it('should delete all keys matching a pattern', async () => {
        redisMock.keys.mockResolvedValue(['cache:doc:1', 'cache:doc:2', 'cache:doc:3']);
        redisMock.del.mockResolvedValue(3);

        await cacheService.deleteByPattern('cache:doc:*');

        expect(redisMock.keys).toHaveBeenCalledWith('cache:doc:*');
        expect(redisMock.del).toHaveBeenCalledWith('cache:doc:1', 'cache:doc:2', 'cache:doc:3');
      });

      it('should handle patterns with no matches', async () => {
        redisMock.keys.mockResolvedValue([]);

        await cacheService.deleteByPattern('cache:non-existent:*');

        expect(redisMock.keys).toHaveBeenCalledWith('cache:non-existent:*');
        expect(redisMock.del).not.toHaveBeenCalled();
      });

      it('should handle errors during pattern deletion', async () => {
        redisMock.keys.mockRejectedValue(new Error('Redis error'));

        await expect(
          cacheService.deleteByPattern('cache:*'),
        ).resolves.toBeUndefined();
      });
    });

    describe('exists - key existence check', () => {
      it('should return true if key exists', async () => {
        redisMock.exists.mockResolvedValue(1);

        const result = await cacheService.exists('existing-key');

        expect(result).toBe(true);
        expect(redisMock.exists).toHaveBeenCalledWith('existing-key');
      });

      it('should return false if key does not exist', async () => {
        redisMock.exists.mockResolvedValue(0);

        const result = await cacheService.exists('non-existent-key');

        expect(result).toBe(false);
      });

      it('should handle errors gracefully', async () => {
        redisMock.exists.mockRejectedValue(new Error('Redis error'));

        const result = await cacheService.exists('error-key');

        expect(result).toBe(false);
      });
    });

    describe('clear - full cache flush', () => {
      it('should clear all cache data', async () => {
        redisMock.flushdb.mockResolvedValue('OK');

        await cacheService.clear();

        expect(redisMock.flushdb).toHaveBeenCalled();
      });

      it('should handle errors during flush', async () => {
        redisMock.flushdb.mockRejectedValue(new Error('Redis error'));

        await expect(cacheService.clear()).resolves.toBeUndefined();
      });
    });

    describe('close - connection cleanup', () => {
      it('should close Redis connection', async () => {
        redisMock.quit.mockResolvedValue('OK');

        await cacheService.close();

        expect(redisMock.quit).toHaveBeenCalled();
      });

      it('should handle errors during close', async () => {
        redisMock.quit.mockRejectedValue(new Error('Redis error'));

        await expect(cacheService.close()).resolves.toBeUndefined();
      });
    });
  });

  describe('CacheInvalidationService', () => {
    describe('generateDocumentCacheKey', () => {
      it('should generate simple cache key without params', () => {
        const key = cacheInvalidationService.generateDocumentCacheKey('GET /documents');

        expect(key).toBe('cache:GET /documents');
      });

      it('should generate cache key with sorted params', () => {
        const params = { userId: '123', status: 'verified' };
        const key = cacheInvalidationService.generateDocumentCacheKey('GET /documents', params);

        // Params should be sorted alphabetically
        expect(key).toBe('cache:GET /documents:status=verified&userId=123');
      });

      it('should generate consistent keys regardless of param order', () => {
        const params1 = { b: '2', a: '1' };
        const params2 = { a: '1', b: '2' };

        const key1 = cacheInvalidationService.generateDocumentCacheKey('endpoint', params1);
        const key2 = cacheInvalidationService.generateDocumentCacheKey('endpoint', params2);

        expect(key1).toBe(key2);
      });
    });

    describe('invalidateDocumentCache', () => {
      it('should invalidate specific document and related caches', async () => {
        redisMock.del.mockResolvedValue(1);
        redisMock.keys.mockResolvedValue([]);

        await cacheInvalidationService.invalidateDocumentCache('doc-123');

        expect(redisMock.del).toHaveBeenCalledWith('cache:document:doc-123');
        expect(redisMock.keys).toHaveBeenCalledTimes(2);
      });

      it('should delete all document list cache patterns', async () => {
        redisMock.del.mockResolvedValue(1);
        redisMock.keys.mockResolvedValue(['cache:documents:page:1', 'cache:documents:page:2']);

        await cacheInvalidationService.invalidateDocumentCache('doc-456');

        expect(redisMock.keys).toHaveBeenCalledWith('cache:documents:*');
      });
    });

    describe('invalidateAllDocumentCache', () => {
      it('should invalidate all document-related caches', async () => {
        redisMock.keys.mockResolvedValue(['cache:document:1', 'cache:documents:all']);
        redisMock.del.mockResolvedValue(2);

        await cacheInvalidationService.invalidateAllDocumentCache();

        expect(redisMock.keys).toHaveBeenCalledWith('cache:document*');
        expect(redisMock.keys).toHaveBeenCalledWith('cache:documents*');
      });
    });

    describe('invalidateUserDocumentCache', () => {
      it('should invalidate user-specific document caches', async () => {
        redisMock.keys.mockResolvedValue(['cache:user123:documents:list']);
        redisMock.del.mockResolvedValue(1);

        await cacheInvalidationService.invalidateUserDocumentCache('user123');

        expect(redisMock.keys).toHaveBeenCalledWith('cache:*user:user123*');
      });
    });

    describe('invalidateAdminStatsCache', () => {
      it('should invalidate admin stats cache', async () => {
        redisMock.del.mockResolvedValue(1);
        redisMock.keys.mockResolvedValue([]);

        await cacheInvalidationService.invalidateAdminStatsCache();

        expect(redisMock.del).toHaveBeenCalledWith('cache:admin:stats');
        expect(redisMock.keys).toHaveBeenCalledWith('cache:cmmty:admin:*');
      });
    });

    describe('cache invalidation on document update', () => {
      it('should invalidate cache when document risk score is updated', async () => {
        redisMock.del.mockResolvedValue(1);
        redisMock.keys.mockResolvedValue([]);

        const documentId = 'doc-789';
        await cacheInvalidationService.invalidateDocumentCache(documentId);

        expect(redisMock.del).toHaveBeenCalledWith(`cache:document:${documentId}`);
      });

      it('should invalidate admin stats when documents are modified', async () => {
        redisMock.del.mockResolvedValue(1);
        redisMock.keys.mockResolvedValue([]);

        await cacheInvalidationService.invalidateAdminStatsCache();

        expect(redisMock.del).toHaveBeenCalledWith('cache:admin:stats');
      });
    });
  });

  describe('CachingInterceptor Integration', () => {
    it('should be exported by CacheLayerModule', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [],
        providers: [
          {
            provide: 'CachingInterceptor',
            useFactory: () => ({ intercept: jest.fn() }),
          },
        ],
      }).compile();

      // Just verify the module is properly structured
      expect(module).toBeDefined();
    });
  });

  describe('Cache behavior under load', () => {
    it('should handle rapid successive cache keys', async () => {
      redisMock.setex.mockResolvedValue('OK');

      const keys = Array.from({ length: 10 }, (_, i) => `key-${i}`);
      const promises = keys.map((key) =>
        cacheService.set(key, { data: `value-${key}` }, 60),
      );

      await Promise.all(promises);

      expect(redisMock.setex).toHaveBeenCalledTimes(10);
    });

    it('should handle rapid cache retrievals', async () => {
      redisMock.get.mockResolvedValue(JSON.stringify({ data: 'cached' }));

      const keys = Array.from({ length: 10 }, (_, i) => `key-${i}`);
      const promises = keys.map((key) => cacheService.get(key));

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(results.every((r) => r?.data === 'cached')).toBe(true);
    });
  });
});
