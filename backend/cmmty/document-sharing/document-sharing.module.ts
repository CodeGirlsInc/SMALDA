import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../../src/documents/entities/document.entity';
import { User } from '../../src/users/entities/user.entity';
import { DocumentShare } from './document-share.entity';
import { DocumentSharingController } from './document-sharing.controller';
import { DocumentSharingService } from './document-sharing.service';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentShare, Document, User])],
  controllers: [DocumentSharingController],
  providers: [DocumentSharingService],
  exports: [DocumentSharingService],
})
export class DocumentSharingModule {}
