import { IsArray, IsISO8601, IsOptional, IsString, Length } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @Length(1, 64)
  name: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
