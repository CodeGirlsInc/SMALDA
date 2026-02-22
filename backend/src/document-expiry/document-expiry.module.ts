import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentExpiry } from './entities/document-expiry.entity';
import { DocumentExpiryController } from './document-expiry.controller';
import { DocumentExpiryService } from './document-expiry.service';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentExpiry])],
  controllers: [DocumentExpiryController],
  providers: [DocumentExpiryService],
  exports: [DocumentExpiryService],
})
export class DocumentExpiryModule {}
