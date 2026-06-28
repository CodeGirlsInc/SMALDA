import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationRecord } from '../verification/entities/verification-record.entity';
import { AdminVerificationsController } from './admin-verifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VerificationRecord])],
  controllers: [AdminVerificationsController],
})
export class AdminVerificationsModule {}
