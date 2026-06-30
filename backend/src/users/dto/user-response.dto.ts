import { UserRole } from '../entities/user.entity';

export class UserResponseDto {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isVerified: boolean;
  preferredLanguage: string;
  createdAt: Date;
  updatedAt: Date;
}
