import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { apiContracts } from '../../common/api-contracts';

export class RegisterAuthDto {
  @IsEmail()
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @IsNotEmpty()
  @MinLength(apiContracts.register.password.minLength)
  password: string;

  @IsNotEmpty()
  @MinLength(apiContracts.register.fullName.minLength)
  @Transform(({ value }) => value?.trim())
  fullName: string;
}
