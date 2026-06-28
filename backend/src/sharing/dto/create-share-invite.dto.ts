import { IsEmail, IsUUID } from 'class-validator';
export class CreateShareInviteDto {
  @IsUUID() documentId: string;
  @IsEmail() invitedEmail: string;
}
