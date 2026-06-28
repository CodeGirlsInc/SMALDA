import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private client: Redis | null = null;

  constructor(private readonly config: ConfigService) {
    super();
    const host = this.config.get<string>('REDIS_HOST');
    const port = this.config.get<number>('REDIS_PORT') || 6379;
    if (host) {
      this.client = new Redis({ host, port, lazyConnect: true });
    }
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    if (!this.client) {
      return this.getStatus(key, false, { message: 'Redis not configured' });
    }
    try {
      await this.client.ping();
      return this.getStatus(key, true);
    } catch (e) {
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, { message: (e as Error).message }),
      );
    }
  }
}
