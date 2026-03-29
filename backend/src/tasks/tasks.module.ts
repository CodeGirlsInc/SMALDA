import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Document } from '../documents/entities/document.entity';
import { QueueModule } from '../queue/queue.module';
import { TasksService } from './tasks.service';

@Module({
  imports: [ScheduleModule.forRoot(), TypeOrmModule.forFeature([Document]), QueueModule],
  providers: [TasksService],
})
export class TasksModule {}
