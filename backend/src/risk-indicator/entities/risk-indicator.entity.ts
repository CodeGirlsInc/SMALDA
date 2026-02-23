import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RiskIndicatorType, RiskIndicatorSeverity } from '../enums/risk-indicator.enum';

@Entity('risk_indicators')
@Index(['documentId'])
@Index(['isResolved'])
export class RiskIndicator {
  @ApiProperty({ description: 'Unique identifier (UUID)' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Foreign key referencing UploadedDocument (stored as UUID column;
  // add a TypeORM relation once the UploadedDocument entity is available)
  @ApiProperty({ description: 'UUID of the associated uploaded document' })
  @Column({ type: 'uuid' })
  documentId: string;

  @ApiProperty({ enum: RiskIndicatorType, description: 'Category of the risk signal' })
  @Column({ type: 'enum', enum: RiskIndicatorType })
  type: RiskIndicatorType;

  @ApiProperty({ enum: RiskIndicatorSeverity, description: 'Severity level of the risk' })
  @Column({ type: 'enum', enum: RiskIndicatorSeverity })
  severity: RiskIndicatorSeverity;

  @ApiProperty({ description: 'Human-readable explanation of the detected risk' })
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({
    description: 'Confidence score (0–1) indicating how certain the system is in this flag',
    minimum: 0,
    maximum: 1,
  })
  @Column({ type: 'decimal', precision: 5, scale: 4 })
  confidence: number;

  @ApiProperty({ description: 'Timestamp when the risk was detected' })
  @CreateDateColumn()
  detectedAt: Date;

  @ApiPropertyOptional({ description: 'Timestamp when the risk was resolved (null if unresolved)' })
  @Column({ type: 'timestamp', nullable: true, default: null })
  resolvedAt: Date | null;

  @ApiProperty({ description: 'Whether the risk indicator has been resolved', default: false })
  @Column({ default: false })
  isResolved: boolean;
}
