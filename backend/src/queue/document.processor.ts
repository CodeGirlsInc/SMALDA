import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QueueScheduler, Worker } from 'bullmq';

import { DocumentsService } from '../documents/documents.service';
import { DocumentStatus } from '../documents/entities/document.entity';
import { VerificationService } from '../verification/verification.service';
import { VerificationStatus } from '../verification/entities/verification-record.entity';
import { RiskAssessmentService } from '../risk-assessment/risk-assessment.service';
import { StellarService } from '../stellar/stellar.service';
import { QueueService } from './queue.service';

/**
 * Events emitted by the document processor:
 *
 * 'document.job.completed' — { jobId, jobName, documentId }
 *   Emitted when a job finishes successfully.
 *
 * 'document.job.failed' — { jobId, jobName, documentId, error }
 *   Emitted when a job fails after all retry attempts.
 */
@Injectable()
export class DocumentProcessor implements OnModuleDestroy {
  private readonly logger = new Logger(DocumentProcessor.name);
  private readonly worker: Worker;
  private readonly scheduler: QueueScheduler;

  constructor(
    private readonly queueService: QueueService,
    private readonly riskService: RiskAssessmentService,
    private readonly documentsService: DocumentsService,
    private readonly stellarService: StellarService,
    private readonly verificationService: VerificationService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const connection = this.queueService.getConnectionOptions();
    this.scheduler = new QueueScheduler(this.queueService.queueName, { connection });
    this.worker = new Worker(
      this.queueService.queueName,
      async (job) => {
        if (job.name === 'analyze') {
          // 25% — starting risk assessment
          await job.updateProgress(25);
          await this.riskService.assessDocument(job.data.documentId);
          // 100% — assessment complete
          await job.updateProgress(100);
          return;
        }
        if (job.name === 'anchor') {
          await this.handleAnchor(job);
        }
      },
      { connection },
    );

    this.worker.on('completed', (job) => {
      this.eventEmitter.emit('document.job.completed', {
        jobId: job.id,
        jobName: job.name,
        documentId: job.data.documentId,
      });
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job.id} (${job.name}) failed`, err?.message, err?.stack);
      this.eventEmitter.emit('document.job.failed', {
        jobId: job.id,
        jobName: job.name,
        documentId: job.data?.documentId,
        error: err?.message,
      });
    });
  }

  private async handleAnchor(job: Parameters<ConstructorParameters<typeof Worker>[1]>[0]) {
    const { documentId } = job.data;

    // 25% — fetching document
    await job.updateProgress(25);
    const document = await this.documentsService.findById(documentId);
    if (!document) {
      this.logger.warn(`Document ${documentId} not found for anchor job`);
      return;
    }

    // 75% — anchoring to Stellar
    await job.updateProgress(75);
    const { txHash, ledger } = await this.stellarService.anchorHash(document.fileHash);
    await this.verificationService.create({
      documentId,
      stellarTxHash: txHash,
      stellarLedger: ledger,
      anchoredAt: new Date(),
      status: VerificationStatus.CONFIRMED,
    });

    await this.documentsService.updateStatus(documentId, DocumentStatus.VERIFIED);
    // 100% — verification complete
    await job.updateProgress(100);
    this.logger.log(`Document ${documentId} verified on ledger ${ledger}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.scheduler?.close();
  }
}
