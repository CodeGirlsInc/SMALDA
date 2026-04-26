import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentArchiveService } from './document-archive.service';
import { DocumentArchiveController } from './document-archive.controller';
import { Document } from '../../src/documents/entities/document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  controllers: [DocumentArchiveController],
  providers: [DocumentArchiveService],
  exports: [DocumentArchiveService],
})
export class DocumentArchiveModule {}
