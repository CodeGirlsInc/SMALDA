import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ActivityTrackerService } from "./activity-tracker.service"
import { ActivityTrackerController } from "./activity-tracker.controller"
import { Activity } from "./entities/activity.entity"

@Module({
  imports: [TypeOrmModule.forFeature([Activity])],
  controllers: [ActivityTrackerController],
  providers: [ActivityTrackerService],
  exports: [ActivityTrackerService], // Export so other modules can log activities
})
export class ActivityTrackerModule {}
