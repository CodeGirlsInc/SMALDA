import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ApiKeyScope } from '../entities/api-key.entity';

export class CreateApiKeyDto {
  @IsString()
  @Length(1, 64)
  name: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ApiKeyScope, { each: true })
  scopes?: ApiKeyScope[];

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
