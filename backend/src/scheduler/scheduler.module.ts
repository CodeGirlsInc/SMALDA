import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { Document } from '../documents/entities/document.entity';
import { VerificationRecord } from '../verification/entities/verification-record.entity';
import { QueueModule } from '../queue/queue.module';
import { DocumentSchedulerService } from './document-scheduler.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, VerificationRecord]),
    QueueModule,
  ],
  providers: [DocumentSchedulerService],
})
export class SchedulerModule {}
