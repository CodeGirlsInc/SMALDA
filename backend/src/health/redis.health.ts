import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const host = this.configService.get<string>('REDIS_HOST') || '127.0.0.1';
    const port = Number(this.configService.get<string>('REDIS_PORT') || '6379');
    const password =
      this.configService.get<string>('REDIS_PASSWORD') || undefined;

    const redis = new Redis({ host, port, password, lazyConnect: true });

    try {
      await redis.connect();
      await redis.ping();
      await redis.quit();
      return this.getStatus(key, true);
    } catch (e) {
      await redis.quit().catch(() => {});
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, { message: (e as Error).message }),
      );
    }
  }
}
