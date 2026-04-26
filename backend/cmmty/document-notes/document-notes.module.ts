import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentNotesController } from './document-notes.controller';
import { DocumentNotesService } from './document-notes.service';
import { DocumentNote } from './entities/document-note.entity';
import { DocumentsModule } from '../../src/documents/documents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentNote]),
    DocumentsModule, // For DocumentsService
  ],
  controllers: [DocumentNotesController],
  providers: [DocumentNotesService],
  exports: [DocumentNotesService],
})
export class DocumentNotesModule {}