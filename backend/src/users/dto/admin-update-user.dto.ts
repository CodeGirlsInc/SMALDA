import { IsEnum } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class AdminUpdateUserDto {
  @IsEnum(UserRole)
  role: UserRole;
}
