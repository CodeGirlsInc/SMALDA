import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { DocumentHistoryService } from "./document-history.service"
import { DocumentHistoryController } from "./document-history.controller"
import { Document } from "./entities/document.entity"
import { DocumentVersion } from "./entities/document-version.entity"
import { OcrExtractionModule } from "../ocr-extraction/ocr-extraction.module"
import { TaggingModule } from "../tagging/tagging.module"
import { PropertyOwnerModule } from "../property-owner/property-owner.module" // NEW

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentVersion]),
    OcrExtractionModule,
    TaggingModule,
    PropertyOwnerModule, // NEW
  ],
  controllers: [DocumentHistoryController],
  providers: [DocumentHistoryService],
  exports: [DocumentHistoryService],
})
export class DocumentHistoryModule {}
