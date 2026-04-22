import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, ConnectionOptions as RedisConnectionOptions } from 'bullmq';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queue: Queue;
  private readonly connection: RedisConnectionOptions;
  readonly queueName = 'document-processing';

  constructor(private readonly configService: ConfigService) {
    this.connection = this.buildConnection();
    this.queue = new Queue(this.queueName, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
      },
    });
  }

  private buildConnection(): RedisConnectionOptions {
    const host = this.configService.get<string>('REDIS_HOST') || '127.0.0.1';
    const port = Number(this.configService.get<string>('REDIS_PORT') || '6379');
    const password = this.configService.get<string>('REDIS_PASSWORD') || undefined;
    return { host, port, password };
  }

  getConnectionOptions(): RedisConnectionOptions {
    return this.connection;
  }

  async enqueueAnalyze(documentId: string) {
    return this.queue.add('analyze', { documentId });
  }

  async enqueueAnchor(documentId: string) {
    return this.queue.add('anchor', { documentId });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
