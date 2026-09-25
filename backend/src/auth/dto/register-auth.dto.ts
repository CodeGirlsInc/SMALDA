import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterAuthDto {
  @IsEmail()
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, { message: 'passwordUppercase' })
  @Matches(/[a-z]/, { message: 'passwordLowercase' })
  @Matches(/[0-9]/, { message: 'passwordNumber' })
  @Matches(/[^A-Za-z0-9]/, { message: 'passwordSpecial' })
  password: string;

  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  fullName: string;
}
