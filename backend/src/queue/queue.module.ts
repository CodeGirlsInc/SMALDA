import { forwardRef, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Inject } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module';
import { RiskAssessmentModule } from '../risk-assessment/risk-assessment.module';
import { StellarModule } from '../stellar/stellar.module';
import { VerificationModule } from '../verification/verification.module';
import { DocumentProcessor } from './document.processor';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => DocumentsModule),
    RiskAssessmentModule,
    StellarModule,
    VerificationModule,
  ],
  controllers: [QueueController],
  providers: [QueueService, DocumentProcessor],
  exports: [QueueService],
})
export class QueueModule {}
