import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, ConnectionOptions as RedisConnectionOptions } from 'bullmq';
import { JOB_NAMES, DEDUP_KEY_PREFIX } from './job.constants';

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
        removeOnFail: false,
      },
    });
  }

  private buildConnection(): RedisConnectionOptions {
    const host = this.configService.get<string>('REDIS_HOST') || '127.0.0.1';
    const port = Number(this.configService.get<string>('REDIS_PORT') || '6379');
    const password =
      this.configService.get<string>('REDIS_PASSWORD') || undefined;
    return { host, port, password };
  }

  getConnectionOptions(): RedisConnectionOptions {
    return this.connection;
  }

  async enqueueAnalyze(documentId: string) {
    return this.queue.add(JOB_NAMES.ANALYZE, { documentId });
  }

  async enqueueAnchor(documentId: string) {
    return this.queue.add(
      JOB_NAMES.ANCHOR,
      { documentId },
      { jobId: `${DEDUP_KEY_PREFIX.ANCHOR}:${documentId}` },
    );
  }

  async getQueueStats() {
    const counts = await this.queue.getJobCounts();
    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
