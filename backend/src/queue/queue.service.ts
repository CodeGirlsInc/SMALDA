import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, ConnectionOptions as RedisConnectionOptions } from 'bullmq';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queue: Queue;
  private readonly deadLetterQueue: Queue;
  private readonly connection: RedisConnectionOptions;
  readonly queueName = 'document-processing';
  readonly deadLetterQueueName = 'document-processing-dead-letter';

  constructor(private readonly configService: ConfigService) {
    this.connection = this.buildConnection();
    this.queue = new Queue(this.queueName, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: false,
      },
    });
    this.deadLetterQueue = new Queue(this.deadLetterQueueName, {
      connection: this.connection,
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

  async getFailedJobs() {
    const failed = await this.queue.getFailed(0, 100);
    return failed.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    }));
  }

  async retryJob(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    await job.retry();
  }

  async moveToDeadLetter(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) return;
    await this.deadLetterQueue.add(job.name, job.data, {
      jobId: job.id,
    });
    await job.remove();
    this.logger.warn(`Job ${jobId} moved to dead-letter queue`);
  }

  async reconcileStuckJobs(): Promise<number> {
    const active = await this.queue.getActive(0, 100);
    const stuckThreshold = Date.now() - 30 * 60 * 1000;
    let requeued = 0;
    for (const job of active) {
      if (job.timestamp < stuckThreshold) {
        await job.moveToFailed(new Error('Job stuck — requeued by reconciliation'), job.id);
        requeued++;
      }
    }
    this.logger.log(`Reconciliation: ${requeued} stuck jobs requeued`);
    return requeued;
  }

  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.deadLetterQueue.close();
  }
}
