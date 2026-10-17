import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const KEY_PREFIX = 'revoked:token:';

/**
 * Revocations live in Redis so they survive restarts and are shared between
 * instances. Every lookup fails closed: if the store cannot be reached the
 * request is rejected instead of silently accepting a revoked token.
 */
@Injectable()
export class TokenRevocationService implements OnModuleDestroy {
  private client: Redis | null = null;
  private connection: Promise<Redis> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    if (!jti || ttlSeconds <= 0) return;

    const client = await this.getClient();
    try {
      await client.set(`${KEY_PREFIX}${jti}`, '1', 'EX', ttlSeconds);
    } catch {
      throw new ServiceUnavailableException(
        'Token revocation store is unavailable',
      );
    }
  }

  async isRevoked(jti?: string): Promise<boolean> {
    if (!jti) return false;

    const client = await this.getClient();
    try {
      return (await client.exists(`${KEY_PREFIX}${jti}`)) === 1;
    } catch {
      throw new ServiceUnavailableException(
        'Token revocation store is unavailable',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
      this.client = null;
      this.connection = null;
    }
  }

  private getClient(): Promise<Redis> {
    if (!this.connection) {
      const client = new Redis({
        host: this.configService.get<string>('REDIS_HOST') || '127.0.0.1',
        port: Number(this.configService.get<string>('REDIS_PORT') || '6379'),
        password:
          this.configService.get<string>('REDIS_PASSWORD') || undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });

      this.connection = client
        .connect()
        .then(() => {
          this.client = client;
          return client;
        })
        .catch((error) => {
          this.connection = null;
          client.disconnect();
          throw error;
        });
    }

    return this.connection;
  }
}
