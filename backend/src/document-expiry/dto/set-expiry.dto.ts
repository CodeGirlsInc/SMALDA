import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class SetExpiryDto {
  @ApiProperty({
    description: 'UUID of the document this expiry record belongs to',
    example: 'b3d2c1a0-0000-0000-0000-000000000001',
  })
  @IsUUID()
  documentId: string;

  @ApiProperty({
    description: 'Expiry date in ISO 8601 format (YYYY-MM-DD)',
    example: '2025-12-31',
  })
  @IsDateString()
  expiryDate: string;

  @ApiPropertyOptional({
    description:
      'Days before expiry at which an alert should be raised and used as the renewal window. Defaults to 30.',
    example: 30,
    default: 30,
    minimum: 1,
    maximum: 3650,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  renewalPeriodDays?: number = 30;

  @ApiPropertyOptional({
    description: 'Optional notes about the expiry or renewal process',
    example: 'Must be renewed at the state land bureau office.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  notes?: string;
}
