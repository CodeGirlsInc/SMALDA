import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { FeedbackService } from "./feedback.service"
import { FeedbackController } from "./feedback.controller"
import { Feedback } from "./entities/feedback.entity"
import { FeedbackComment } from "./entities/feedback-comment.entity" // Import new entity

@Module({
  imports: [TypeOrmModule.forFeature([Feedback, FeedbackComment])], // Add FeedbackComment to TypeOrmModule
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService], // Export if other modules need to interact with FeedbackService
})
export class FeedbackModule {}
