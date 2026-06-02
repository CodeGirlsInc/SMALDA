import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Activity } from '../../activity-tracker/entities/activity.entity';
import { UserActivityController } from './user-activity.controller';
import { UserActivityDashboardService } from './user-activity-dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Activity])],
  controllers: [UserActivityController],
  providers: [UserActivityDashboardService],
})
export class UserActivityModule {}
