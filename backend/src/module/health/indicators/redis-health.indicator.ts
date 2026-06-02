import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { createClient } from 'redis';

import { QueueService } from '../../../queue/queue.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly queueService: QueueService,
  ) {}

  async checkRedis(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    const connection = this.queueService.getConnectionOptions();
    const redisConnection = connection as {
      host?: string;
      port?: number;
      password?: string;
    };
    const host = redisConnection.host || '127.0.0.1';
    const port = redisConnection.port || 6379;
    const client = createClient({
      socket: {
        host,
        port,
      },
      password: redisConnection.password,
    });

    try {
      await client.connect();
      const pong = await client.ping();

      if (pong !== 'PONG') {
        return indicator.down({
          host,
          port,
          message: `Unexpected ping response: ${pong}`,
        });
      }

      return indicator.up({
        host,
        port,
      });
    } catch (error) {
      return indicator.down({
        host,
        port,
        message:
          error instanceof Error ? error.message : 'Redis health check failed',
      });
    } finally {
      if (client.isOpen) {
        await client.quit().catch(() => client.disconnect());
      } else {
        client.disconnect();
      }
    }
  }
}
