/**
 * Example: Using Cache Invalidation with Document Service
 * 
 * This file demonstrates how to integrate the CacheInvalidationService
 * with document update operations to keep the cache in sync.
 * 
 * NOTE: This is an example file. To integrate, inject CacheInvalidationService
 * into your DocumentsService and call the appropriate invalidation methods
 * when documents are updated.
 */

import { Injectable } from '@nestjs/common';
import { CacheInvalidationService } from './services/cache-invalidation.service';

/**
 * Example DocumentsService integration with cache invalidation
 * 
 * Usage in your actual service:
 * 
 * @Injectable()
 * export class DocumentsService {
 *   constructor(
 *     @InjectRepository(Document) private readonly documentRepository: Repository<Document>,
 *     private readonly cacheInvalidationService: CacheInvalidationService,
 *   ) {}
 * 
 *   async updateStatus(id: string, status: DocumentStatus): Promise<Document | null> {
 *     await this.documentRepository.update(id, { status });
 *     
 *     // Invalidate cache when document status changes
 *     await this.cacheInvalidationService.invalidateDocumentCache(id);
 *     
 *     return this.findById(id);
 *   }
 * 
 *   async updateRisk(id: string, score: number, flags: string[]): Promise<Document | null> {
 *     await this.documentRepository.update(id, { riskScore: score, riskFlags: flags });
 *     
 *     // Invalidate caches affected by risk score update
 *     await this.cacheInvalidationService.invalidateDocumentCache(id);
 *     // Also invalidate admin stats since risk score affects the stats
 *     await this.cacheInvalidationService.invalidateAdminStatsCache();
 *     
 *     return this.findById(id);
 *   }
 * 
 *   async delete(id: string): Promise<void> {
 *     await this.documentRepository.delete(id);
 *     
 *     // Invalidate all document caches on deletion
 *     await this.cacheInvalidationService.invalidateAllDocumentCache();
 *   }
 * }
 */

/**
 * Example Controller usage with Cacheable decorator
 * 
 * Usage:
 * 
 * @Controller('documents')
 * export class DocumentsController {
 *   constructor(
 *     private readonly documentsService: DocumentsService,
 *   ) {}
 * 
 *   @Get()
 *   @UseInterceptors(CachingInterceptor)
 *   @Cacheable('all-documents', 120)  // Cache for 120 seconds
 *   async getAll() {
 *     return this.documentsService.findAll();
 *   }
 * 
 *   @Get(':id')
 *   @UseInterceptors(CachingInterceptor)
 *   @Cacheable((req) => `document:${req.params.id}`, 60)  // Dynamic cache key
 *   async getOne(@Param('id') id: string) {
 *     return this.documentsService.findById(id);
 *   }
 * 
 *   @Get('owner/:ownerId')
 *   @UseInterceptors(CachingInterceptor)
 *   @Cacheable((req) => `documents:owner:${req.params.ownerId}`, 300)
 *   async getByOwner(@Param('ownerId') ownerId: string) {
 *     return this.documentsService.findByOwner(ownerId);
 *   }
 * }
 */

/**
 * Example: Using cache with AdminStats (already created endpoint)
 * 
 * In admin-stats.controller.ts:
 * 
 * import { Cacheable } from '../cache-layer/decorators/cacheable.decorator';
 * import { CachingInterceptor } from '../cache-layer/interceptors/caching.interceptor';
 * 
 * @Controller('cmmty/admin')
 * export class AdminStatsController {
 *   constructor(
 *     private readonly adminStatsService: AdminStatsService,
 *     private readonly cacheInvalidationService: CacheInvalidationService,
 *   ) {}
 * 
 *   @Get('stats')
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @UseInterceptors(CachingInterceptor)
 *   @Roles(UserRole.ADMIN)
 *   @Cacheable('admin:stats', 300)  // Cache admin stats for 5 minutes
 *   async getStats(): Promise<AdminStatsDto> {
 *     return this.adminStatsService.getPlatformStats();
 *   }
 * }
 */

export const CACHE_INVALIDATION_EXAMPLES = {
  onDocumentStatusChange: 'Call invalidateDocumentCache(documentId)',
  onDocumentRiskUpdate: 'Call invalidateDocumentCache(documentId) and invalidateAdminStatsCache()',
  onDocumentDelete: 'Call invalidateAllDocumentCache()',
  onUserDocumentsUpdate: 'Call invalidateUserDocumentCache(userId)',
  onDatabaseSync: 'Call clear() to flush entire cache',
};
