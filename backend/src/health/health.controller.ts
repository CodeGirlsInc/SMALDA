import { Controller, Get, Inject } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

/**
 * Health check endpoint that validates the Redis connection before
 * reporting the service as healthy. Closes #1342
 */
@Controller('health')
export class HealthController {
  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Get()
  async check(): Promise<{ status: string; redis: string }> {
    let redisStatus = 'ok';

    try {
      await this.redis.ping();
    } catch {
      redisStatus = 'unreachable';
    }

    const overall = redisStatus === 'ok' ? 'ok' : 'degraded';

    return {
      status: overall,
      redis: redisStatus,
    };
  }
}
