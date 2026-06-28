import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationService } from './verification.service';
import { VerificationRecord } from './entities/verification-record.entity';
import { VerificationController } from './verification.controller';
import { VerifyPublicController } from './verify-public.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VerificationRecord])],
  controllers: [VerificationController, VerifyPublicController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
