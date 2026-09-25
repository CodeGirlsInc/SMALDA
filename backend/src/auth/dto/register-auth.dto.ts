import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { apiContracts } from '../../common/api-contracts';

export class RegisterAuthDto {
  @IsEmail()
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @IsString()
  @MinLength(apiContracts.register.password.minLength)
  @Matches(/[A-Z]/, { message: 'passwordUppercase' })
  @Matches(/[a-z]/, { message: 'passwordLowercase' })
  @Matches(/[0-9]/, { message: 'passwordNumber' })
  @Matches(/[^A-Za-z0-9]/, { message: 'passwordSpecial' })
  password: string;

  @IsNotEmpty()
  @MinLength(apiContracts.register.fullName.minLength)
  @Transform(({ value }) => value?.trim())
  fullName: string;
}
