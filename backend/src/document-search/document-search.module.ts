import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LandRecord } from '../land-record/entities/land-record.entity';
import { DocumentSearchService } from './document-search.service';
import { DocumentSearchController } from './document-search.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LandRecord])],
  controllers: [DocumentSearchController],
  providers: [DocumentSearchService],
  exports: [DocumentSearchService],
})
export class DocumentSearchModule {}
