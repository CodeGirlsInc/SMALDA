import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { DocumentCommentsService } from "./document-comments.service"
import { DocumentCommentsController } from "./document-comments.controller"
import { DocumentComment } from "./entities/document-comment.entity"

@Module({
  imports: [TypeOrmModule.forFeature([DocumentComment])],
  controllers: [DocumentCommentsController],
  providers: [DocumentCommentsService],
  exports: [DocumentCommentsService],
})
export class DocumentCommentsModule {}
