import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, ConnectionOptions } from 'bullmq';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queue: Queue;
  private readonly dlq: Queue;
  private readonly connection: RedisConnectionOptions;
  readonly queueName = 'document-processing';
  readonly dlqName = 'document-processing:dlq';

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
    this.dlq = new Queue(this.dlqName, {
      connection: this.connection,
      defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
    });
  }

  private buildConnection(): ConnectionOptions {
    const host = this.configService.get<string>('REDIS_HOST') || '127.0.0.1';
    const port = Number(this.configService.get<string>('REDIS_PORT') || '6379');
    const password = this.configService.get<string>('REDIS_PASSWORD') || undefined;
    return { host, port, password };
  }

  getConnectionOptions(): ConnectionOptions {
    return this.connection;
  }

  // BE-28: Deduplication via deterministic jobId
  async enqueueAnalyze(documentId: string) {
    return this.queue.add('analyze', { documentId }, { jobId: `analyze:${documentId}` });
  }

  async enqueueAnchor(documentId: string) {
    return this.queue.add('anchor', { documentId }, { jobId: `anchor:${documentId}` });
  }

  // BE-25: Dead-letter queue
  async addToDLQ(jobName: string, data: unknown, failedReason: string) {
    return this.dlq.add(jobName, { ...data as object, failedReason, failedAt: new Date() });
  }

  // BE-27: Monitoring methods
  async getStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);
    return { queue: this.queueName, waiting, active, completed, failed, delayed };
  }

  async getFailedJobs() {
    return this.queue.getFailed();
  }

  async getDLQJobs() {
    return this.dlq.getJobs(['waiting', 'failed', 'completed']);
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.dlq.close();
  }
}
