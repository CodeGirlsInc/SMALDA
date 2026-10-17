import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { apiContracts } from '../../common/api-contracts';

export class LoginAuthDto {
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsNotEmpty()
  @MinLength(apiContracts.login.password.minLength)
  password: string;
}