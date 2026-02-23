import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportingService } from './reporting.service';
import { ReportingController } from './reporting.controller';

import { Document } from '../documents/entities/document.entity';
import { RiskIndicator } from '../risk/entities/risk-indicator.entity';
import { LandRecord } from '../land/entities/land-record.entity';
import { Workflow } from '../workflow/entities/workflow.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Document,
      RiskIndicator,
      LandRecord,
      Workflow,
    ]),
  ],
  controllers: [ReportingController],
  providers: [ReportingService],
  exports: [ReportingService],
})
export class ReportingModule {}