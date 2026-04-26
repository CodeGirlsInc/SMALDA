import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RateLimitService } from './rate-limit.service';
import { RateLimitMiddleware } from './rate-limit.middleware';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST') || '127.0.0.1';
        const port = Number(configService.get<string>('REDIS_PORT') || '6379');
        const password = configService.get<string>('REDIS_PASSWORD') || undefined;

        return new Redis({
          host,
          port,
          password,
          lazyConnect: true,
        });
      },
      inject: [ConfigService],
    },
    RateLimitService,
    RateLimitMiddleware,
  ],
  exports: [RateLimitService, RateLimitMiddleware],
})
export class RateLimitModule {}