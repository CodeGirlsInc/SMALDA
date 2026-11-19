import { IsString, Matches, MinLength } from 'class-validator';
import { apiContracts } from '../../common/api-contracts';

export class SetPasswordDto {
  @IsString()
  @MinLength(apiContracts.register.password.minLength)
  @Matches(/[A-Z]/, { message: 'passwordUppercase' })
  @Matches(/[a-z]/, { message: 'passwordLowercase' })
  @Matches(/[0-9]/, { message: 'passwordNumber' })
  @Matches(/[^A-Za-z0-9]/, { message: 'passwordSpecial' })
  newPassword: string;
}
