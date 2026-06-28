import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { Document, DocumentStatus } from '../documents/entities/document.entity';
import {
  VerificationRecord,
  VerificationStatus,
} from '../verification/entities/verification-record.entity';
import { QueueService } from '../queue/queue.service';

const STUCK_THRESHOLD_MINUTES = 30;

@Injectable()
export class DocumentSchedulerService {
  private readonly logger = new Logger(DocumentSchedulerService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(VerificationRecord)
    private readonly verificationRepository: Repository<VerificationRecord>,
    private readonly queueService: QueueService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async detectStuckDocuments() {
    const threshold = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000);
    const stuckStatuses = [DocumentStatus.PENDING, DocumentStatus.ANALYZING];

    const stuck = await this.documentRepository.find({
      where: {
        status: stuckStatuses as unknown as DocumentStatus,
        createdAt: LessThan(threshold),
      },
    });

    for (const doc of stuck) {
      this.logger.warn(`Document ${doc.id} stuck in ${doc.status} since ${doc.createdAt}`);
      await this.documentRepository.update(doc.id, { status: DocumentStatus.FLAGGED });
    }

    if (stuck.length > 0) {
      this.logger.log(`Marked ${stuck.length} stuck documents as FLAGGED`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async retryFailedVerifications() {
    const failed = await this.verificationRepository.find({
      where: { status: VerificationStatus.FAILED },
    });

    for (const record of failed) {
      this.logger.log(`Retrying failed verification ${record.id} for document ${record.documentId}`);
      await this.queueService.enqueueAnchor(record.documentId);
    }

    if (failed.length > 0) {
      this.logger.log(`Re-enqueued ${failed.length} failed verifications for retry`);
    }
  }
}
