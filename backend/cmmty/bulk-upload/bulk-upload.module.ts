import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BulkUploadService } from './bulk-upload.service';
import { BulkUploadController } from './bulk-upload.controller';
import { DocumentsModule } from '../../src/documents/documents.module';
import { QueueModule } from '../../src/queue/queue.module';

@Module({
  imports: [ConfigModule, DocumentsModule, QueueModule],
  controllers: [BulkUploadController],
  providers: [BulkUploadService],
  exports: [BulkUploadService],
})
export class BulkUploadModule {}
