import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Approval } from './approval.entity';
import { ApprovalService } from './approval.service';
import { ApprovalController } from './approval.controller';
import { VerificationRecord } from '../verification/entities/verification-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Approval, VerificationRecord])],
  controllers: [ApprovalController],
  providers: [ApprovalService],
  exports: [ApprovalService],
})
export class ApprovalModule {}
