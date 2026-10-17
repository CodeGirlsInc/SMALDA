import { IsString, Length, MinLength } from 'class-validator';

export class TwoFactorCodeDto {
  @IsString()
  @Length(4, 32)
  code: string;
}

export class TwoFactorChallengeDto {
  @IsString()
  twoFactorToken: string;

  @IsString()
  @Length(4, 32)
  code: string;
}

export class DisableTwoFactorDto {
  @IsString()
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
