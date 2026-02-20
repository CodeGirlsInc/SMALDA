import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RiskIndicatorSeverity, RiskIndicatorType } from '../enums/risk-indicator.enum';

export class CreateRiskIndicatorDto {
  @ApiProperty({ description: 'UUID of the associated uploaded document' })
  @IsUUID()
  documentId: string;

  @ApiProperty({
    enum: RiskIndicatorType,
    description: 'Category of the risk signal',
    example: RiskIndicatorType.MISSING_FIELD,
  })
  @IsEnum(RiskIndicatorType)
  type: RiskIndicatorType;

  @ApiProperty({
    enum: RiskIndicatorSeverity,
    description: 'Severity level of the risk',
    example: RiskIndicatorSeverity.HIGH,
  })
  @IsEnum(RiskIndicatorSeverity)
  severity: RiskIndicatorSeverity;

  @ApiProperty({ description: 'Human-readable explanation of the detected risk' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Confidence score (0–1) indicating how certain the system is in this flag',
    minimum: 0,
    maximum: 1,
    example: 0.95,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;
}
