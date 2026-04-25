import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordChangeService } from './password-change.service';
import { PasswordChangeController } from './password-change.controller';
import { User } from '../../src/users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [PasswordChangeController],
  providers: [PasswordChangeService],
  exports: [PasswordChangeService],
})
export class PasswordChangeModule {}