import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StellarService } from './stellar.service';
import { VerifierClient } from './verifier-client.service';

@Module({
  imports: [ConfigModule],
  providers: [StellarService, VerifierClient],
  exports: [StellarService, VerifierClient],
})
export class StellarModule {}
