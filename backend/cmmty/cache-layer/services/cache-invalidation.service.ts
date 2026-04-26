import { Injectable } from '@nestjs/common';
import { CacheService } from './cache.service';

@Injectable()
export class CacheInvalidationService {
  constructor(private readonly cacheService: CacheService) {}

  /**
   * Generate a cache key for a document endpoint
   */
  generateDocumentCacheKey(endpoint: string, params?: Record<string, string>): string {
    if (params) {
      const paramString = Object.entries(params)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
      return `cache:${endpoint}:${paramString}`;
    }
    return `cache:${endpoint}`;
  }

  /**
   * Invalidate all cache related to a specific document
   */
  async invalidateDocumentCache(documentId: string): Promise<void> {
    // Invalidate specific document cache
    await this.cacheService.delete(`cache:document:${documentId}`);
    
    // Invalidate document list caches (match all patterns with wildcard)
    await this.cacheService.deleteByPattern('cache:documents:*');
    await this.cacheService.deleteByPattern(`cache:*document*${documentId}*`);
  }

  /**
   * Invalidate all document-related caches
   */
  async invalidateAllDocumentCache(): Promise<void> {
    await this.cacheService.deleteByPattern('cache:document*');
    await this.cacheService.deleteByPattern('cache:documents*');
  }

  /**
   * Invalidate user-specific document caches
   */
  async invalidateUserDocumentCache(userId: string): Promise<void> {
    await this.cacheService.deleteByPattern(`cache:*user:${userId}*`);
  }

  /**
   * Invalidate admin stats cache
   */
  async invalidateAdminStatsCache(): Promise<void> {
    await this.cacheService.delete('cache:admin:stats');
    await this.cacheService.deleteByPattern('cache:cmmty:admin:*');
  }
}
