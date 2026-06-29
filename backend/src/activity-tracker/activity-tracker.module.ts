import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from './entities/activity.entity';
import { ActivityTrackerService } from './activity-tracker.service';

@Module({
  imports: [TypeOrmModule.forFeature([Activity])],
  providers: [ActivityTrackerService],
  exports: [ActivityTrackerService],
})
export class ActivityTrackerModule {}
