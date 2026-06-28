import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'bullmq';

import { DocumentsService } from '../documents/documents.service';
import { DocumentStatus } from '../documents/entities/document.entity';
import { VerificationService } from '../verification/verification.service';
import { VerificationStatus } from '../verification/entities/verification-record.entity';
import { RiskAssessmentService } from '../risk-assessment/risk-assessment.service';
import { StellarService } from '../stellar/stellar.service';
import { QueueService } from './queue.service';
import { DocumentsGateway } from '../gateway/documents.gateway';

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
    private readonly documentsGateway: DocumentsGateway,
  ) {
    const connection = this.queueService.getConnectionOptions();
    this.worker = new Worker(
      this.queueService.queueName,
      async (job) => {
        if (job.name === 'analyze') {
          await this.riskService.assessDocument(job.data.documentId);
          const doc = await this.documentsService.findById(job.data.documentId);
          if (doc) {
            this.documentsGateway.notifyDocumentStatusChange(doc.id, doc.status);
          }
          return;
        }
        if (job.name === 'anchor') {
          await this.handleAnchor(job.data.documentId);
        }
      },
      { connection },
    );

    this.worker.on('failed', async (job, err) => {
      this.logger.error(`Job ${job.id} (${job.name}) failed: ${err.message}`, err.stack);

      if (job.name === 'anchor' && job.attemptsMade >= 3) {
        try {
          await this.verificationService.create({
            documentId: job.data.documentId,
            stellarTxHash: '',
            stellarLedger: 0,
            anchoredAt: new Date(),
            status: VerificationStatus.FAILED,
          });
          await this.documentsService.updateStatus(
            job.data.documentId,
            DocumentStatus.FLAGGED,
          );
          this.documentsGateway.notifyDocumentStatusChange(job.data.documentId, DocumentStatus.FLAGGED);
          this.documentsGateway.notifyVerificationUpdate(job.data.documentId, 'failed');
          this.logger.warn(`Dead-letter handled for anchor job ${job.id}`);
        } catch (e) {
          this.logger.error(`Failed to record dead-letter for job ${job.id}`, e?.message);
        }
      }
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
    this.documentsGateway.notifyDocumentStatusChange(documentId, DocumentStatus.VERIFIED);
    this.documentsGateway.notifyVerificationUpdate(documentId, 'confirmed', txHash);
    this.logger.log(`Document ${documentId} verified on ledger ${ledger}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
