import { Inject, Injectable, Logger, OnModuleDestroy, forwardRef } from '@nestjs/common';
import { Worker } from 'bullmq';

import { DocumentsService } from '../documents/documents.service';
import { DocumentsGateway } from '../documents/documents.gateway';
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
    @Inject(forwardRef(() => DocumentsGateway))
    private readonly documentsGateway: DocumentsGateway,
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

  private async handleAnalyze(documentId: string) {
    const document = await this.documentsService.findById(documentId);
    if (!document) {
      this.logger.warn(`Document ${documentId} not found for analyze job`);
      return;
    }

    const prevStatus = document.status;

    if (prevStatus === DocumentStatus.PENDING) {
      await this.documentsService.updateStatus(documentId, DocumentStatus.ANALYZING);
      this.documentsGateway.notifyStatusChanged(documentId, DocumentStatus.ANALYZING, prevStatus);
    }

    const result = await this.riskService.assessDocument(documentId);

    let newStatus: DocumentStatus;
    if (result.score >= 60) {
      newStatus = DocumentStatus.FLAGGED;
    } else {
      newStatus = DocumentStatus.VERIFIED;
    }

    await this.documentsService.updateStatus(documentId, newStatus);
    this.documentsGateway.notifyStatusChanged(documentId, newStatus, DocumentStatus.ANALYZING);
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

    const prevStatus = document.status;
    await this.documentsService.updateStatus(
      documentId,
      DocumentStatus.VERIFIED,
    );

    this.documentsGateway.notifyStatusChanged(documentId, DocumentStatus.VERIFIED, prevStatus);
    this.logger.log(`Document ${documentId} verified on ledger ${ledger}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
