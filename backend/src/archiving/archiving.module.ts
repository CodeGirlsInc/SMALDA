import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ConfigModule } from "@nestjs/config"
import { ArchivingController } from "./archiving.controller"
import { ArchivingService } from "./archiving.service"
import { ArchiveStorageService } from "./services/archive-storage.service"
import { ArchiveSchedulerService } from "./services/archive-scheduler.service"
import { ArchivedDocument } from "./entities/archived-document.entity"
import { ArchivePolicy } from "./entities/archive-policy.entity"
import { ArchiveJob } from "./entities/archive-job.entity"

@Module({
  imports: [TypeOrmModule.forFeature([ArchivedDocument, ArchivePolicy, ArchiveJob]), ConfigModule],
  controllers: [ArchivingController],
  providers: [ArchivingService, ArchiveStorageService, ArchiveSchedulerService],
  exports: [ArchivingService],
})
export class ArchivingModule {}
