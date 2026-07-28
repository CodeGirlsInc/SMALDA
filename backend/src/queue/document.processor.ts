import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'bullmq';

import { DocumentsService } from '../documents/documents.service';
import { DocumentStatus } from '../documents/entities/document.entity';
import { VerificationService } from '../verification/verification.service';
import { VerificationStatus } from '../verification/entities/verification-record.entity';
import { RiskAssessmentService } from '../risk-assessment/risk-assessment.service';
import { StellarService } from '../stellar/stellar.service';
import { QueueService, DocumentJobData } from './queue.service';
import {
  generateCorrelationId,
  runWithCorrelationId,
} from '../common/correlation/correlation-id.storage';

@Injectable()
export class DocumentProcessor implements OnModuleDestroy {
  private readonly logger = new Logger(DocumentProcessor.name);
  private readonly worker: Worker;

  constructor(
    private readonly queueService: QueueService,
    private readonly riskService: RiskAssessmentService,
    private readonly documentsService: DocumentsService,
    private readonly stellarService: StellarService,
    private readonly verificationService: VerificationService,
  ) {
    const connection = this.queueService.getConnectionOptions();
    this.worker = new Worker(
      this.queueService.queueName,
      async (job) => {
        const data = job.data as DocumentJobData;
        const requestId = data.requestId || generateCorrelationId();

        return runWithCorrelationId(requestId, async () => {
          this.logger.log(
            `Processing job ${job.id} (${job.name}) for document ${data.documentId}`,
          );

          if (job.name === 'analyze') {
            await this.riskService.assessDocument(data.documentId);
            return;
          }
          if (job.name === 'anchor') {
            await this.handleAnchor(data.documentId);
          }
        });
      },
      { connection },
    );

    this.worker.on('failed', (job, err) => {
      const data = (job?.data as DocumentJobData) ?? { documentId: 'unknown' };
      const requestId = data.requestId || 'unknown';
      this.logger.error(
        `Job ${job?.id} (${job?.name}) failed (request ${requestId}): ${err?.message}`,
        err?.stack,
      );
    });
  }

  private async handleAnchor(documentId: string) {
    const document = await this.documentsService.findById(documentId);
    if (!document) {
      this.logger.warn(`Document ${documentId} not found for anchor job`);
      return;
    }

    const { txHash, ledger } = await this.stellarService.anchorHash(
      document.fileHash,
    );
    await this.verificationService.create({
      documentId,
      stellarTxHash: txHash,
      stellarLedger: ledger,
      anchoredAt: new Date(),
      status: VerificationStatus.CONFIRMED,
    });

    await this.documentsService.updateStatus(
      documentId,
      DocumentStatus.VERIFIED,
    );
    this.logger.log(`Document ${documentId} verified on ledger ${ledger}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
