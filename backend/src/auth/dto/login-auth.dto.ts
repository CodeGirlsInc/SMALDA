import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { apiContracts } from '../../common/api-contracts';

export class LoginAuthDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(apiContracts.login.password.minLength)
  password: string;
}
