import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsModule } from '../documents/documents.module';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';
import { VerificationRecord } from './entities/verification-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([VerificationRecord]),
    forwardRef(() => DocumentsModule),
  ],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
