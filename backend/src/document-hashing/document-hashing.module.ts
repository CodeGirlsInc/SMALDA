import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadedDocument } from './entities/uploaded-document.entity';
import { DocumentHashingService } from './document-hashing.service';

@Module({
  imports: [TypeOrmModule.forFeature([UploadedDocument])],
  providers: [DocumentHashingService],
  exports: [DocumentHashingService],
})
export class DocumentHashingModule {}
