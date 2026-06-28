import { IsEmail, IsOptional, IsIn } from 'class-validator';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsIn(['admin', 'member'])
  role?: 'admin' | 'member' = 'member';
}
