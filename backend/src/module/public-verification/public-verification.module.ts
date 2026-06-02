import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { DocumentsModule } from '../../documents/documents.module';
import { StellarModule } from '../../stellar/stellar.module';
import { VerificationModule } from '../../verification/verification.module';
import { PublicVerificationController } from './public-verification.controller';
import { PublicVerificationService } from './public-verification.service';

@Module({
  imports: [
    DocumentsModule,
    StellarModule,
    VerificationModule,
    ThrottlerModule.forRoot([
      {
        limit: 30,
        ttl: 60_000,
      },
    ]),
  ],
  controllers: [PublicVerificationController],
  providers: [PublicVerificationService, ThrottlerGuard],
})
export class PublicVerificationModule {}
