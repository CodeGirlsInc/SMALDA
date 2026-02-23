import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BatchJobStatus } from '../enums/batch-job-status.enum';

export interface BatchDocumentResult {
  documentId: string;
  originalName: string;
  status: 'pending' | 'success' | 'failed';
  hash?: string;
  error?: string;
}

@Entity('batch_jobs')
export class BatchJob {
  @ApiProperty({ description: 'Unique batch job identifier (UUID)' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    enum: BatchJobStatus,
    description: 'Current processing status of the batch',
  })
  @Column({ type: 'enum', enum: BatchJobStatus, default: BatchJobStatus.PENDING })
  status: BatchJobStatus;

  @ApiProperty({ description: 'Total number of documents submitted in this batch' })
  @Column({ type: 'int' })
  totalDocuments: number;

  @ApiProperty({ description: 'Number of documents successfully processed', default: 0 })
  @Column({ type: 'int', default: 0 })
  processedCount: number;

  @ApiProperty({ description: 'Number of documents that failed during processing', default: 0 })
  @Column({ type: 'int', default: 0 })
  failedCount: number;

  @ApiProperty({
    description:
      'Per-document processing results including document ID, status, SHA-256 hash, and any error message',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        documentId: { type: 'string' },
        originalName: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'success', 'failed'] },
        hash: { type: 'string', nullable: true },
        error: { type: 'string', nullable: true },
      },
    },
  })
  @Column({ type: 'jsonb', default: [] })
  results: BatchDocumentResult[];

  @ApiProperty({ description: 'Timestamp when the batch was submitted' })
  @CreateDateColumn()
  submittedAt: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when all documents finished processing',
    nullable: true,
  })
  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
