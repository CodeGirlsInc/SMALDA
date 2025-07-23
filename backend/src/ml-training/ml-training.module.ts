import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { DatasetRecord } from "./entities/dataset-record.entity"
import { DatasetTag } from "./entities/dataset-tag.entity"
import { HumanReview } from "./entities/human-review.entity"
import { Feedback } from "./entities/feedback.entity"
import { TrainingExport } from "./entities/training-export.entity"
import { DatasetRecordsService } from "./services/dataset-records.service"
import { DatasetTagsService } from "./services/dataset-tags.service"
import { HumanReviewsService } from "./services/human-reviews.service"
import { FeedbackService } from "./services/feedback.service"
import { TrainingExportService } from "./services/training-export.service"
import { DatasetRecordsController } from "./controllers/dataset-records.controller"
import { DatasetTagsController } from "./controllers/dataset-tags.controller"
import { HumanReviewsController } from "./controllers/human-reviews.controller"
import { FeedbackController } from "./controllers/feedback.controller"
import { TrainingExportController } from "./controllers/training-export.controller"
import { RolesModule } from "../roles/roles.module"

@Module({
  imports: [TypeOrmModule.forFeature([DatasetRecord, DatasetTag, HumanReview, Feedback, TrainingExport]), RolesModule],
  controllers: [
    DatasetRecordsController,
    DatasetTagsController,
    HumanReviewsController,
    FeedbackController,
    TrainingExportController,
  ],
  providers: [DatasetRecordsService, DatasetTagsService, HumanReviewsService, FeedbackService, TrainingExportService],
  exports: [DatasetRecordsService, DatasetTagsService, HumanReviewsService, FeedbackService, TrainingExportService],
})
export class MlTrainingModule {}
