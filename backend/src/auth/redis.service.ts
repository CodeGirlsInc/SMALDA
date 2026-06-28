import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  // Key prefix for the token blocklist
  private readonly BLOCKLIST_PREFIX = 'auth:blocklist:';

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      retryStrategy: (times) => {
        if (times > 3) {
          return null; // Stop retrying after 3 attempts
        }
        return Math.min(times * 1000, 3000); // Exponential backoff
      },
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis client error: ${err.message}`);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis client connected');
    });
  }

  /**
   * Add a token to the blocklist with a TTL (in seconds)
   * @param tokenIdentifier - Unique identifier for the token (e.g., JTI or hash)
   * @param ttlSeconds - Time-to-live in seconds
   */
  async addToBlocklist(
    tokenIdentifier: string,
    ttlSeconds: number,
  ): Promise<void> {
    const key = `${this.BLOCKLIST_PREFIX}${tokenIdentifier}`;
    await this.client.set(key, '1', 'EX', ttlSeconds);
    this.logger.debug(
      `Token added to blocklist: ${tokenIdentifier} (TTL: ${ttlSeconds}s)`,
    );
  }

  /**
   * Check if a token is in the blocklist
   * @param tokenIdentifier - Unique identifier for the token
   * @returns true if the token is revoked, false otherwise
   */
  async isTokenRevoked(tokenIdentifier: string): Promise<boolean> {
    const key = `${this.BLOCKLIST_PREFIX}${tokenIdentifier}`;
    const result = await this.client.get(key);
    return result !== null;
  }

  /**
   * Calculate the remaining TTL for a JWT token
   * @param token - The JWT token
   * @returns TTL in seconds based on token expiration
   */
  getTokenRemainingTtl(token: string): number {
    try {
      // Decode JWT payload (second part) to get expiration time
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString('utf-8'),
      );

      if (!payload.exp) {
        // Default to 15 minutes if no expiration found
        return 900;
      }

      const now = Math.floor(Date.now() / 1000);
      const remaining = payload.exp - now;

      // Return at least 1 second, or 0 if already expired
      return Math.max(0, remaining);
    } catch (error) {
      this.logger.error('Failed to decode JWT for TTL calculation', error);
      return 900; // Default to 15 minutes
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log('Redis client disconnected');
  }

  /**
   * Get the Redis client for advanced operations
   */
  getClient(): Redis {
    return this.client;
  }
}
