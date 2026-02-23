import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationWorkflow } from './entities/verification-workflow.entity';
import { VerificationWorkflowController } from './verification-workflow.controller';
import { VerificationWorkflowService } from './verification-workflow.service';

@Module({
  imports: [TypeOrmModule.forFeature([VerificationWorkflow])],
  controllers: [VerificationWorkflowController],
  providers: [VerificationWorkflowService],
  exports: [VerificationWorkflowService],
})
export class VerificationWorkflowModule {}
