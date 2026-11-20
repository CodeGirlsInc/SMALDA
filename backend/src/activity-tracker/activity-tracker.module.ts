import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from './entities/activity.entity';
import { ActivityTrackerService } from './activity-tracker.service';
import { ActivityTrackerController } from './activity-tracker.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Activity])],
  providers: [ActivityTrackerService],
  controllers: [ActivityTrackerController],
  exports: [ActivityTrackerService],
})
export class ActivityTrackerModule {}
