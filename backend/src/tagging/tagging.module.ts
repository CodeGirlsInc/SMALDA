import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { TaggingService } from "./tagging.service"
import { TaggingController } from "./tagging.controller"
import { Tag } from "./entities/tag.entity"

@Module({
  imports: [TypeOrmModule.forFeature([Tag])],
  controllers: [TaggingController],
  providers: [TaggingService],
  exports: [TaggingService], // Export TaggingService for use in other modules (e.g., DocumentHistory)
})
export class TaggingModule {}
