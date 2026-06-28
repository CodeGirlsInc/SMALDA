import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Document } from '../documents/entities/document.entity';
import { VerificationRecord } from '../verification/entities/verification-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Document, VerificationRecord])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
