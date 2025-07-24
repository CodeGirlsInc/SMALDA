import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ReviewController } from "./controllers/review.controller"
import { ReviewService } from "./services/review.service"
import { Review } from "./entities/review.entity"
import { ReviewComment } from "./entities/review-comment.entity"
import { DocumentModule } from "../document/document.module"

@Module({
  imports: [TypeOrmModule.forFeature([Review, ReviewComment]), DocumentModule],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
