import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ExchangeOAuthCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  code: string;
}
