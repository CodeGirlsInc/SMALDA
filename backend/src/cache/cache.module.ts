import { CacheModule as NestCacheModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';
import { CacheService } from './cache.service';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      isGlobal: true,
      useFactory: (config: ConfigService) => ({
        store: redisStore,
        host: config.get('REDIS_HOST') || '127.0.0.1',
        port: parseInt(config.get('REDIS_PORT') || '6379'),
        password: config.get('REDIS_PASSWORD') || undefined,
        ttl: 300,
      }),
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
