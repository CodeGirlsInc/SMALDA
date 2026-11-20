import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

/** #1561: typed, validated bodies for the email/password endpoints. */
export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResendVerificationDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Password must contain upper, lower, digit and special characters',
  })
  password!: string;
}

export class VerifyEmailQueryDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
