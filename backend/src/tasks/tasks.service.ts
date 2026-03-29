import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { Document, DocumentStatus } from '../documents/entities/document.entity';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly queueService: QueueService,
  ) {}

  @Cron('0 2 * * *')
  async cleanUpStaleDocuments(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stale = await this.documentRepository.find({
      where: [
        { status: DocumentStatus.ANALYZING, updatedAt: LessThan(cutoff) },
        { status: DocumentStatus.PENDING, updatedAt: LessThan(cutoff) },
      ],
    });

    if (!stale.length) {
      this.logger.log('Stale document cleanup: no stale documents found.');
      return;
    }

    let requeued = 0;
    for (const doc of stale) {
      try {
        await this.queueService.enqueueAnalyze(doc.id);
        requeued++;
      } catch {
        await this.documentRepository.update(doc.id, {
          status: DocumentStatus.REJECTED,
          riskFlags: ['timeout'],
        });
      }
    }

    this.logger.log(
      `Stale document cleanup: ${requeued}/${stale.length} re-enqueued, ${stale.length - requeued} marked REJECTED.`,
    );
  }
}
