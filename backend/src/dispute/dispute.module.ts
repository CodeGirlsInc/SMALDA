import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispute } from './entities/dispute.entity';
import { DisputeReason } from './entities/dispute-reason.entity';
import { DisputeReasonClassifierService } from './dispute-reason-classifier.service';
import { DisputeService } from './dispute.service';
import { DisputeController } from './dispute.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Dispute, DisputeReason])],
  controllers: [DisputeController],
  providers: [DisputeService, DisputeReasonClassifierService],
  exports: [DisputeService],
})
export class DisputeModule {}
