import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DocumentsModule } from '../documents/documents.module';
import { RiskAssessmentModule } from '../risk-assessment/risk-assessment.module';
import { StellarModule } from '../stellar/stellar.module';
import { VerificationModule } from '../verification/verification.module';
import { DocumentProcessor } from './document.processor';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => DocumentsModule),
    forwardRef(() => RiskAssessmentModule),
    StellarModule,
    VerificationModule,
  ],
  controllers: [QueueController],
  providers: [QueueService, DocumentProcessor],
  exports: [QueueService],
})
export class QueueModule {}
