import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../document-history/entities/document.entity';
import { DocumentVersion } from '../document-history/entities/document-version.entity';
import { Review } from '../review/entities/review.entity';
import { Activity } from '../activity-tracker/entities/activity.entity';
import { TimelineGeneratorService } from './timeline-generator.service';
import { TimelineGeneratorController } from './timeline-generator.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentVersion, Review, Activity]),
  ],
  providers: [TimelineGeneratorService],
  controllers: [TimelineGeneratorController],
})
export class TimelineGeneratorModule {} 