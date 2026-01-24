import { Injectable, Logger } from '@nestjs/common';

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly DEFAULT_TTL = 300; // 5 minutes in seconds
  private cache: Map<string, CacheItem<any>> = new Map();

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const item = this.cache.get(key);
      
      if (!item) {
        this.logger.debug(`Cache miss for key: ${key}`);
        return undefined;
      }

      if (Date.now() > item.expiresAt) {
        this.cache.delete(key);
        this.logger.debug(`Cache expired for key: ${key}`);
        return undefined;
      }

      this.logger.debug(`Cache hit for key: ${key}`);
      return item.value as T;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const ttlSeconds = ttl || this.DEFAULT_TTL;
      const expiresAt = Date.now() + (ttlSeconds * 1000);
      
      this.cache.set(key, { value, expiresAt });
      this.logger.debug(`Cache set for key: ${key}, TTL: ${ttlSeconds}s`);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      this.cache.delete(key);
      this.logger.debug(`Cache deleted for key: ${key}`);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  async reset(): Promise<void> {
    try {
      this.cache.clear();
      this.logger.log('Cache reset successfully');
    } catch (error) {
      this.logger.error('Cache reset error:', error);
    }
  }

  generateCacheKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    return `${prefix}:${sortedParams}`;
  }

  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const result = await fn();
    await this.set(key, result, ttl);
    return result;
  }

  // Clean up expired entries periodically
  cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired cache entries`);
    }
  }
}
