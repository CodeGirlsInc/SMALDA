import { UserRole } from '../entities/user.entity';

export class UserResponseDto {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isVerified: boolean;
  isTwoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;

  static from(user: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    isVerified: boolean;
    isTwoFactorEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.fullName = user.fullName;
    dto.role = user.role;
    dto.isVerified = user.isVerified;
    dto.isTwoFactorEnabled = user.isTwoFactorEnabled;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
