import { IsEmail, IsOptional, IsString } from 'class-validator';
import { Exclude, Expose } from 'class-transformer';
import { UserRole } from '../../users/entities/user.entity';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

@Exclude()
export class UserResponseDto {
  @Expose() id: string;
  @Expose() email: string;
  @Expose() fullName: string;
  @Expose() role: UserRole;
  @Expose() isVerified: boolean;
  @Expose() preferredLanguage: string;
  @Expose() createdAt: Date;
}