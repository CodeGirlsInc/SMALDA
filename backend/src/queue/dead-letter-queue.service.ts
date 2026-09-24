import { Injectable, Logger } from '@nestjs/common';

/**
 * Dead-letter queue for document jobs that fail permanently, so they
 * are surfaced for manual investigation instead of silently lost.
 */
@Injectable()
export class DeadLetterQueueService {
  private readonly logger = new Logger(DeadLetterQueueService.name);
  private readonly deadLetters: Array<{ jobId: string; reason: string; failedAt: Date }> = [];

  moveToDeadLetter(jobId: string, reason: string): void {
    this.deadLetters.push({ jobId, reason, failedAt: new Date() });
    this.logger.warn(`Job ${jobId} moved to dead-letter queue: ${reason}`);
  }

  listDeadLetters() {
    return [...this.deadLetters];
  }
}
