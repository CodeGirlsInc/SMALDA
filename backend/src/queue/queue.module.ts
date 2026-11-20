import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DocumentsModule } from '../documents/documents.module';
import { RiskAssessmentModule } from '../risk-assessment/risk-assessment.module';
import { StellarModule } from '../stellar/stellar.module';
import { VerificationModule } from '../verification/verification.module';
import { MetricsModule } from '../metrics/metrics.module';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { DocumentProcessor } from './document.processor';
import { QueueService } from './queue.service';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => DocumentsModule),
    RiskAssessmentModule,
    StellarModule,
    VerificationModule,
    forwardRef(() => MetricsModule),
  ],
  providers: [QueueService, DocumentProcessor, DeadLetterQueueService],
  exports: [QueueService, DeadLetterQueueService],
})
export class QueueModule {}
