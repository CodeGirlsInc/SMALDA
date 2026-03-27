import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationService } from './verification.service';
import { VerificationRecord } from './entities/verification-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VerificationRecord])],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
