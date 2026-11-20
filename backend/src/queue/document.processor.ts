import {
  Inject,
  Injectable,
  Logger,
  Optional,
  OnModuleDestroy,
  forwardRef,
} from '@nestjs/common';
import { Worker } from 'bullmq';

import { DocumentsService } from '../documents/documents.service';
import { DocumentsGateway } from '../documents/documents.gateway';
import { DocumentStatus } from '../documents/entities/document.entity';
import { VerificationService } from '../verification/verification.service';
import { VerificationStatus } from '../verification/entities/verification-record.entity';
import { RiskAssessmentService } from '../risk-assessment/risk-assessment.service';
import { getRiskThresholds } from '../risk-assessment/risk-thresholds.config';
import { StellarService } from '../stellar/stellar.service';
import { MetricsService } from '../metrics/metrics.service';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
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
    private readonly deadLetterQueue: DeadLetterQueueService,
    private readonly metricsService: MetricsService,
    @Optional() private readonly notificationsService?: NotificationsService,
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
            await this.handleAnalyze(data.documentId);
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

      const attempts = job?.opts.attempts ?? 1;
      const attemptsMade = job?.attemptsMade ?? attempts;
      if (!job || attemptsMade < attempts) return;

      // Exhausted all retries: move the job aside for inspection so it is
      // not silently lost, and make sure the document leaves ANALYZING.
      this.deadLetterQueue.moveToDeadLetter(
        String(job.id),
        err?.message ?? 'Unknown error',
      );
      if (job.name === 'analyze') {
        void this.markAnalysisFailed(data.documentId);
      }
    });
  }

  private async markAnalysisFailed(documentId: string): Promise<void> {
    if (!documentId || documentId === 'unknown') return;
    try {
      const document = await this.documentsService.findById(documentId);
      const previousStatus = document?.status ?? DocumentStatus.ANALYZING;
      await this.documentsService.updateStatus(
        documentId,
        DocumentStatus.FAILED_ANALYSIS,
      );
      this.documentsGateway.notifyStatusChanged(
        documentId,
        DocumentStatus.FAILED_ANALYSIS,
        previousStatus,
      );
      this.logger.warn(
        `Document ${documentId} moved to a terminal failed-analysis state after exhausting all attempts`,
      );
    } catch (error) {
      this.logger.error(
        `Could not mark document ${documentId} as failed analysis: ${(error as Error).message}`,
      );
    }
  }

  private async handleAnalyze(documentId: string) {
    const document = await this.documentsService.findById(documentId);
    if (!document) {
      this.logger.warn(`Document ${documentId} not found for analyze job`);
      return;
    }

    const prevStatus = document.status;

    if (prevStatus === DocumentStatus.PENDING) {
      await this.documentsService.updateStatus(
        documentId,
        DocumentStatus.ANALYZING,
      );
      this.documentsGateway.notifyStatusChanged(
        documentId,
        DocumentStatus.ANALYZING,
        prevStatus,
      );
    }

    const result = await this.riskService.assessDocument(documentId);

    let newStatus: DocumentStatus;
    if (result.score >= getRiskThresholds().medium) {
      newStatus = DocumentStatus.FLAGGED;
    } else {
      newStatus = DocumentStatus.VERIFIED;
    }

    await this.documentsService.updateStatus(documentId, newStatus);
    this.documentsGateway.notifyStatusChanged(
      documentId,
      newStatus,
      DocumentStatus.ANALYZING,
    );

    if (newStatus === DocumentStatus.FLAGGED) {
      await this.notify(
        document.ownerId,
        NotificationType.RISK_ALERT,
        'Document flagged for review',
        `Your document scored ${result.score} and needs manual review.`,
        documentId,
      );
    }
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

    const isAnchored = await this.stellarService.verifyHash(document.fileHash);
    if (!isAnchored) {
      this.logger.error(
        `Document ${documentId} hash not found on Stellar after anchoring`,
      );
      await this.verificationService.create({
        documentId,
        stellarTxHash: txHash,
        stellarLedger: ledger,
        anchoredAt: new Date(),
        status: VerificationStatus.FAILED,
      });
      this.metricsService.incVerificationsTotal();
      return;
    }

    await this.verificationService.create({
      documentId,
      stellarTxHash: txHash,
      stellarLedger: ledger,
      anchoredAt: new Date(),
      status: VerificationStatus.CONFIRMED,
    });

    this.metricsService.incVerificationsTotal();

    const prevStatus = document.status;
    await this.documentsService.updateStatus(
      documentId,
      DocumentStatus.VERIFIED,
    );

    this.documentsGateway.notifyStatusChanged(
      documentId,
      DocumentStatus.VERIFIED,
      prevStatus,
    );
    await this.notify(
      document.ownerId,
      NotificationType.VERIFICATION_COMPLETE,
      'Document verification complete',
      `Your document was verified on Stellar (ledger ${ledger}).`,
      documentId,
    );

    this.logger.log(`Document ${documentId} verified on ledger ${ledger}`);
  }

  private async notify(
    userId: string | undefined,
    type: NotificationType,
    title: string,
    body: string,
    documentId: string,
  ): Promise<void> {
    if (!this.notificationsService || !userId) return;
    try {
      await this.notificationsService.create(userId, type, title, body, documentId);
    } catch (error) {
      // A failed notification must never fail the document job itself.
      this.logger.warn(`Could not persist notification for ${documentId}: ${error?.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
