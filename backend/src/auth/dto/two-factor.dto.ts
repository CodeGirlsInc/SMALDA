import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnableTwoFactorDto {
  @ApiProperty({ description: 'TOTP code from authenticator app' })
  @IsString()
  code: string;
}

export class DisableTwoFactorDto {
  @ApiProperty({ description: 'Current TOTP code from authenticator app' })
  @IsString()
  code: string;
}

export class VerifyTwoFactorDto {
  @ApiProperty({ description: 'TOTP code from authenticator app' })
  @IsString()
  code: string;
}
