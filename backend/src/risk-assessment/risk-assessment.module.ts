import { forwardRef, Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { RiskAssessmentController } from './risk-assessment.controller';
import { RiskAssessmentService } from './risk-assessment.service';

@Module({
  imports: [forwardRef(() => DocumentsModule)],
  controllers: [RiskAssessmentController],
  providers: [RiskAssessmentService],
  exports: [RiskAssessmentService],
})
export class RiskAssessmentModule {}
