import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LandRecordStatus } from '../enums/land-record.enum';

export class CreateLandRecordDto {
  @ApiProperty({
    description: 'Unique parcel identifier assigned by a land registry',
    example: 'PARCEL-2024-00123',
  })
  @IsString()
  @IsNotEmpty()
  parcelId: string;

  @ApiProperty({
    description: 'Human-readable address or coordinates of the parcel',
    example: '45 Broad Street, Lagos, Nigeria',
  })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({
    description: 'Land area in square meters',
    example: 500.75,
  })
  @IsNumber()
  @IsPositive()
  area: number;

  @ApiProperty({
    description: 'Full name of the current owner',
    example: 'Emeka Okafor',
  })
  @IsString()
  @IsNotEmpty()
  ownerName: string;

  @ApiPropertyOptional({
    description: 'Phone number or email address of the owner',
    example: '+2348012345678',
  })
  @IsOptional()
  @IsString()
  ownerContact?: string;

  @ApiProperty({
    description: 'Date the parcel was officially registered (ISO 8601 date)',
    example: '2024-01-15',
  })
  @IsDateString()
  registrationDate: string;

  @ApiPropertyOptional({
    enum: LandRecordStatus,
    description: 'Initial status of the land record (defaults to ACTIVE)',
    example: LandRecordStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(LandRecordStatus)
  status?: LandRecordStatus;
}
