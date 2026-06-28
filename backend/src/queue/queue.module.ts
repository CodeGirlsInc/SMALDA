import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DocumentsModule } from '../documents/documents.module';
import { RiskAssessmentModule } from '../risk-assessment/risk-assessment.module';
import { StellarModule } from '../stellar/stellar.module';
import { VerificationModule } from '../verification/verification.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { DocumentProcessor } from './document.processor';
import { QueueService } from './queue.service';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => DocumentsModule),
    RiskAssessmentModule,
    StellarModule,
    VerificationModule,
    MailModule,
    UsersModule,
  ],
  providers: [QueueService, DocumentProcessor],
  exports: [QueueService],
})
export class QueueModule {}
