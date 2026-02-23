import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowState } from '../enums/workflow-state.enum';

export interface WorkflowHistoryEntry {
  state: WorkflowState;
  timestamp: string; // ISO-8601
  note?: string;
}

@Entity('verification_workflows')
@Index(['documentId'])
@Index(['currentState'])
export class VerificationWorkflow {
  @ApiProperty({ description: 'Unique identifier (UUID)' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Foreign key referencing UploadedDocument (stored as plain UUID;
  // add a TypeORM relation once the UploadedDocument entity is available)
  @ApiProperty({ description: 'UUID of the document being verified' })
  @Column({ type: 'uuid' })
  documentId: string;

  @ApiProperty({
    enum: WorkflowState,
    description: 'Current state of the verification pipeline',
  })
  @Column({ type: 'enum', enum: WorkflowState, default: WorkflowState.SUBMITTED })
  currentState: WorkflowState;

  @ApiPropertyOptional({
    description: 'Stellar transaction ID once the document has been anchored',
  })
  @Column({ type: 'varchar', nullable: true, default: null })
  stellarTransactionId: string | null;

  @ApiPropertyOptional({
    description: 'Human-readable error message when the workflow reaches FAILED state',
  })
  @Column({ type: 'text', nullable: true, default: null })
  errorMessage: string | null;

  @ApiProperty({ description: 'Timestamp when the workflow was initiated' })
  @CreateDateColumn()
  submittedAt: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the workflow reached a terminal state (ANCHORED / FAILED / REJECTED)',
  })
  @Column({ type: 'timestamp', nullable: true, default: null })
  completedAt: Date | null;

  @ApiProperty({
    description: 'Ordered log of every state the workflow has passed through',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        state: { type: 'string', enum: Object.values(WorkflowState) },
        timestamp: { type: 'string', format: 'date-time' },
        note: { type: 'string' },
      },
    },
  })
  @Column({ type: 'jsonb', default: [] })
  history: WorkflowHistoryEntry[];
}
