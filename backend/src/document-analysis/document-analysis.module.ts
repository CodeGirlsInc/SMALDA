import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../documents/entities/document.entity';
import { DocumentsModule } from '../documents/documents.module';
import { DocumentAnalysisService } from './document-analysis.service';

@Module({
  imports: [TypeOrmModule.forFeature([Document]), DocumentsModule],
  providers: [DocumentAnalysisService],
  exports: [DocumentAnalysisService],
})
export class DocumentAnalysisModule {}
