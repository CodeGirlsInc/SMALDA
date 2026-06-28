import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'bullmq';

import { DocumentsService } from '../documents/documents.service';
import { DocumentStatus } from '../documents/entities/document.entity';
import { VerificationService } from '../verification/verification.service';
import { VerificationStatus } from '../verification/entities/verification-record.entity';
import { RiskAssessmentService } from '../risk-assessment/risk-assessment.service';
import { StellarService } from '../stellar/stellar.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { QueueService } from './queue.service';

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
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
  ) {
    const connection = this.queueService.getConnectionOptions();
    this.worker = new Worker(
      this.queueService.queueName,
      async (job) => {
        if (job.name === 'analyze') {
          await this.handleAnalyze(job.data.documentId);
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

  private async handleAnalyze(documentId: string) {
    const riskResult = await this.riskService.assessDocument(documentId);
    if (riskResult.flags.length === 0) {
      return;
    }

    const document = await this.documentsService.findById(documentId);
    if (!document) {
      this.logger.warn(`Document ${documentId} not found for risk alert`);
      return;
    }

    const user = await this.usersService.findById(document.ownerId);
    if (!user?.email) {
      this.logger.warn(`Owner ${document.ownerId} not found for risk alert`);
      return;
    }

    try {
      await this.mailService.sendRiskAlert(
        user.email,
        document.title,
        riskResult.flags.map(String),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to send risk alert for document ${documentId}`,
        message,
        stack,
      );
    }
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
  }
}
