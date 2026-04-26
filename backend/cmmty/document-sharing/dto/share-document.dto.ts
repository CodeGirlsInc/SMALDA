import { IsEmail } from 'class-validator';

export class ShareDocumentDto {
  @IsEmail()
  email: string;
}
