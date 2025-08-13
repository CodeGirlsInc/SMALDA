// src/dispute-reason-classifier/dispute-reason-classifier.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisputeReasonClassifierService } from './dispute-reason-classifier.service';
import { DisputeReason } from './entities/dispute-reason.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DisputeReason])],
  providers: [DisputeReasonClassifierService],
  exports: [DisputeReasonClassifierService],
})
export class DisputeReasonClassifierModule {}
