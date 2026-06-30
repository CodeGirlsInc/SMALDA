import { IsEmail } from 'class-validator';

export class SendVerificationDto {
  @IsEmail()
  email: string;
}
