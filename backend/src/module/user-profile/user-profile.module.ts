import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserProfileController } from './user-profile.controller';
import { User } from '../../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserProfileController],
})
export class UserProfileModule {}
