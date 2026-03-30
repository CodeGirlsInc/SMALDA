import { UserRole } from '../../users/entities/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  type?: 'reset' | 'verification';
}
