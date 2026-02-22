import {
  AfterLoad,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('document_expiries')
@Index(['documentId'], { unique: true })
export class DocumentExpiry {
  @ApiProperty({ description: 'Unique identifier (UUID)' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'UUID of the uploaded document this expiry record belongs to',
    example: 'b3d2c1a0-0000-0000-0000-000000000001',
  })
  @Column({ type: 'uuid' })
  documentId: string;

  @ApiProperty({
    description: 'Date on which the document legally expires',
    example: '2025-12-31',
    type: 'string',
    format: 'date',
  })
  @Column({ type: 'date' })
  expiryDate: Date;

  @ApiProperty({
    description:
      'How many days before expiry an alert should be raised. ' +
      'Also used as the renewal window when pushing the expiry date forward.',
    example: 30,
    default: 30,
  })
  @Column({ type: 'int', default: 30 })
  renewalPeriodDays: number;

  @ApiProperty({
    description:
      'Computed at load time. True when expiryDate is in the past regardless of renewal status.',
    example: false,
  })
  isExpired: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp of the most recent renewal. Null until the document has been renewed.',
    nullable: true,
  })
  @Column({ type: 'timestamptz', nullable: true, default: null })
  renewedAt: Date | null;

  @ApiPropertyOptional({
    description: 'Free-text notes about this expiry record (e.g. renewal instructions)',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true, default: null })
  notes: string | null;

  @ApiProperty({ description: 'Timestamp when this expiry record was created' })
  @CreateDateColumn()
  createdAt: Date;

  @AfterLoad()
  computeIsExpired(): void {
    this.isExpired = new Date(this.expiryDate) < new Date();
  }
}
