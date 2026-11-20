import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsModule } from '../documents/documents.module';
import { VerificationService } from './verification.service';
import { VerificationCacheService } from './verification-cache.service';
import { VerificationController } from './verification.controller';
import { VerificationRecord } from './entities/verification-record.entity';
import { VerificationCacheService } from './verification-cache.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([VerificationRecord]),
    forwardRef(() => DocumentsModule),
  ],
  controllers: [VerificationController],
  providers: [VerificationService, VerificationCacheService],
  exports: [VerificationService, VerificationCacheService],
})
export class VerificationModule {}
