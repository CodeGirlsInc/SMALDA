import { UserRole } from '../../users/entities/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  jti?: string;
  exp?: number;
  iat?: number;
}
