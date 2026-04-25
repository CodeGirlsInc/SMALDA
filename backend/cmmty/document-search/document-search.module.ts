import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentSearchService } from './document-search.service';
import { DocumentSearchController } from './document-search.controller';
import { Document } from '../../src/documents/entities/document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  controllers: [DocumentSearchController],
  providers: [DocumentSearchService],
  exports: [DocumentSearchService],
})
export class DocumentSearchModule {}