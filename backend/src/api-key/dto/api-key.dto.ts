import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiKeyStatus } from '../entities/api-key.entity';

export class CreateApiKeyDto {
  @ApiProperty({
    example: 'Production API Key',
    description: 'Name for the API key',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'API key for production environment access',
    description: 'Optional description for the API key',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    example: '2024-12-31T23:59:59Z',
    description: 'Optional expiration date for the API key',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateApiKeyDto {
  @ApiProperty({
    example: 'Updated API Key Name',
    description: 'Updated name for the API key',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    example: 'Updated description',
    description: 'Updated description for the API key',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    example: '2025-12-31T23:59:59Z',
    description: 'Updated expiration date for the API key',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class RevokeApiKeyDto {
  @ApiProperty({
    example: 'No longer needed',
    description: 'Reason for revoking the API key',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ApiKeyResponseDto {
  @ApiProperty({ example: 'sk_live_abcd1234...' })
  apiKey?: string; // Only returned when creating

  @ApiProperty({ example: 'sk_live_' })
  prefix: string;

  @ApiProperty({ example: 'Production API Key' })
  name: string;

  @ApiProperty({ example: 'API key for production environment' })
  description?: string;

  @ApiProperty({ example: 'active' })
  status: ApiKeyStatus;

  @ApiProperty({ example: '2024-12-31T23:59:59Z' })
  expiresAt?: Date;

  @ApiProperty({ example: '2024-07-20T10:30:00Z' })
  lastUsedAt?: Date;

  @ApiProperty({ example: 150 })
  usageCount: number;

  @ApiProperty({ example: '2024-07-27T14:30:00Z' })
  createdAt: Date;
}
