import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';
import { PasswordResetToken } from './password-reset-token.entity';
import { User } from '../../src/users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, PasswordResetToken])],
  controllers: [PasswordResetController],
  providers: [PasswordResetService],
  exports: [PasswordResetService],
})
export class PasswordResetModule {}
