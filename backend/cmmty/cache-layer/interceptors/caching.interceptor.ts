import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { CacheService } from '../services/cache.service';

interface CacheMetadata {
  key: string | ((req: any) => string);
  ttl: number;
}

@Injectable()
export class CachingInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private cacheService: CacheService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // Get cache metadata from decorator
    const metadata = this.reflector.get<CacheMetadata | undefined>(
      'cacheable',
      context.getHandler(),
    );

    // If no cache metadata, skip caching
    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();

    // Generate cache key (either static or dynamic)
    const cacheKey =
      typeof metadata.key === 'function'
        ? metadata.key(request)
        : metadata.key;

    // Try to get from cache
    try {
      const cachedData = await this.cacheService.get(cacheKey);
      if (cachedData !== null) {
        return of(cachedData);
      }
    } catch (error) {
      console.error(`Error retrieving cache for key ${cacheKey}:`, error);
      // Continue to execute the handler if cache retrieval fails
    }

    // If not in cache, execute the handler and cache the result
    return next.handle().pipe(
      tap(async (data) => {
        try {
          await this.cacheService.set(cacheKey, data, metadata.ttl);
        } catch (error) {
          console.error(`Error setting cache for key ${cacheKey}:`, error);
          // Don't throw, just log the error
        }
      }),
    );
  }
}
