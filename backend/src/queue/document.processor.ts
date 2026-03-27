import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { QueueScheduler, Worker } from 'bullmq';

import { DocumentsService } from '../documents/documents.service';
import { DocumentStatus } from '../documents/entities/document.entity';
import { VerificationService } from '../verification/verification.service';
import { VerificationStatus } from '../verification/entities/verification-record.entity';
import { RiskAssessmentService } from '../risk-assessment/risk-assessment.service';
import { StellarService } from '../stellar/stellar.service';
import { QueueService } from './queue.service';

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
  ) {
    const connection = this.queueService.getConnectionOptions();
    this.scheduler = new QueueScheduler(this.queueService.queueName, { connection });
    this.worker = new Worker(
      this.queueService.queueName,
      async (job) => {
        if (job.name === 'analyze') {
          await this.riskService.assessDocument(job.data.documentId);
          return;
        }
        if (job.name === 'anchor') {
          await this.handleAnchor(job.data.documentId);
        }
      },
      { connection },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job.id} (${job.name}) failed`, err?.message, err?.stack);
    });
  }

  private async handleAnchor(documentId: string) {
    const document = await this.documentsService.findById(documentId);
    if (!document) {
      this.logger.warn(`Document ${documentId} not found for anchor job`);
      return;
    }

    const { txHash, ledger } = await this.stellarService.anchorHash(document.fileHash);
    await this.verificationService.create({
      documentId,
      stellarTxHash: txHash,
      stellarLedger: ledger,
      anchoredAt: new Date(),
      status: VerificationStatus.CONFIRMED,
    });

    await this.documentsService.updateStatus(documentId, DocumentStatus.VERIFIED);
    this.logger.log(`Document ${documentId} verified on ledger ${ledger}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.scheduler?.close();
  }
}
