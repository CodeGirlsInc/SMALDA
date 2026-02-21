import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LandRecordStatus } from '../enums/land-record.enum';

export class FilterLandRecordDto {
  @ApiPropertyOptional({
    enum: LandRecordStatus,
    description: 'Filter records by status',
    example: LandRecordStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(LandRecordStatus)
  status?: LandRecordStatus;

  @ApiPropertyOptional({
    description: 'Filter records by partial location match (case-insensitive)',
    example: 'Lagos',
  })
  @IsOptional()
  @IsString()
  location?: string;
}
