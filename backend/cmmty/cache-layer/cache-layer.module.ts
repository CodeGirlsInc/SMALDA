import { Module } from '@nestjs/common';
import { CacheService } from './services/cache.service';
import { CacheInvalidationService } from './services/cache-invalidation.service';
import { CachingInterceptor } from './interceptors/caching.interceptor';

@Module({
  providers: [CacheService, CacheInvalidationService, CachingInterceptor],
  exports: [CacheService, CacheInvalidationService, CachingInterceptor],
})
export class CacheLayerModule {}
