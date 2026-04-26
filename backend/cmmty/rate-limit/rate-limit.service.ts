import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RateLimitService {
  private readonly redis: Redis;
  private readonly windowMs: number = 60 * 1000; // 1 minute
  private readonly maxRequests: number;

  constructor(
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') redisClient: Redis,
  ) {
    this.redis = redisClient;
    this.maxRequests = Number(this.configService.get('RATE_LIMIT_REQUESTS_PER_MINUTE', 100));
  }

  async isRateLimited(ip: string): Promise<{ limited: boolean; resetTime?: number }> {
    const key = `rate_limit:${ip}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove old entries outside the sliding window
    await this.redis.zremrangebyscore(key, '-inf', windowStart);

    // Count requests in the current window
    const requestCount = await this.redis.zcount(key, windowStart, '+inf');

    if (requestCount >= this.maxRequests) {
      // Get the oldest timestamp in the window to calculate reset time
      const oldestTimestamp = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetTime = oldestTimestamp.length > 0
        ? Number(oldestTimestamp[1]) + this.windowMs
        : now + this.windowMs;

      return { limited: true, resetTime };
    }

    // Add current request timestamp
    await this.redis.zadd(key, now, now.toString());

    // Set expiration on the key (cleanup after window + some buffer)
    await this.redis.expire(key, Math.ceil(this.windowMs / 1000) + 60);

    return { limited: false };
  }

  async getRemainingRequests(ip: string): Promise<number> {
    const key = `rate_limit:${ip}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove old entries
    await this.redis.zremrangebyscore(key, '-inf', windowStart);

    // Count current requests
    const requestCount = await this.redis.zcount(key, windowStart, '+inf');

    return Math.max(0, this.maxRequests - requestCount);
  }

  getMaxRequests(): number {
    return this.maxRequests;
  }