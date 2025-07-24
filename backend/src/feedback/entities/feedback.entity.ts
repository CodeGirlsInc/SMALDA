{
  ;`import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { FeedbackType } from '../enums/feedback-type.enum';
import { FeedbackStatus } from '../enums/feedback-status.enum';
import { FeedbackPriority } from '../enums/feedback-priority.enum';
import { FeedbackSeverity } from '../enums/feedback-severity.enum'; // New enum
import { FeedbackSource } from '../enums/feedback-source.enum'; // New enum
import { FeedbackComment } from './feedback-comment.entity'; // New entity
import { ApiProperty } from '@nestjs/swagger';

@Entity('feedback')
export class Feedback {
  @ApiProperty({ description: 'Unique identifier for the feedback entry' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'ID of the user who submitted the feedback (optional for anonymous feedback)', nullable: true, format: 'uuid' })
  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @ApiProperty({ enum: FeedbackType, description: 'Type of feedback submitted' })
  @Column({ type: 'enum', enum: FeedbackType, default: FeedbackType.GENERAL_INQUIRY })
  feedbackType: FeedbackType;

  @ApiProperty({ description: 'Subject or title of the feedback' })
  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @ApiProperty({ description: 'Detailed message of the feedback' })
  @Column({ type: 'text' })
  message: string;

  @ApiProperty({ enum: FeedbackStatus, description: 'Current status of the feedback' })
  @Column({ type: 'enum', enum: FeedbackStatus, default: FeedbackStatus.PENDING })
  status: FeedbackStatus;

  @ApiProperty({ enum: FeedbackPriority, description: 'Priority level of the feedback', default: FeedbackPriority.LOW })
  @Column({ type: 'enum', enum: FeedbackPriority, default: FeedbackPriority.LOW })
  priority: FeedbackPriority;

  @ApiProperty({ enum: FeedbackSeverity, description: 'Severity level of the feedback (technical impact)', default: FeedbackSeverity.LOW })
  @Column({ type: 'enum', enum: FeedbackSeverity, default: FeedbackSeverity.LOW })
  severity: FeedbackSeverity; // New field

  @ApiProperty({ enum: FeedbackSource, description: 'Source from which the feedback was submitted', default: FeedbackSource.WEB_APP })
  @Column({ type: 'enum', enum: FeedbackSource, default: FeedbackSource.WEB_APP })
  source: FeedbackSource; // New field

  @ApiProperty({ description: 'Array of URLs or paths to attached files (e.g., screenshots)', type: [String], nullable: true })
  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  attachments?: string[];

  @ApiProperty({ description: 'Additional metadata related to the feedback (e.g., user agent, app version)', type: 'object', additionalProperties: true, nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'ID of the user (e.g., admin) assigned to handle this feedback', nullable: true, format: 'uuid' })
  @Column({ type: 'uuid', nullable: true })
  assignedTo?: string; // New field

  @ApiProperty({ description: 'Detailed notes on how the feedback was resolved', nullable: true })
  @Column({ type: 'text', nullable: true })
  resolutionNotes?: string; // New field

  @ApiProperty({ description: 'Timestamp when the feedback was created' })
  @CreateDateColumn({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp when the feedback was last updated' })
  @UpdateDateColumn({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @ApiProperty({ description: 'Timestamp when the feedback was marked as resolved', nullable: true })
  @Column({ type: 'timestamp with time zone', nullable: true })
  resolvedAt?: Date;

  @ApiProperty({ description: 'ID of the user who resolved the feedback', nullable: true, format: 'uuid' })
  @Column({ type: 'uuid', nullable: true })
  resolvedBy?: string;

  @ApiProperty({ description: 'Timestamp when the feedback was soft-deleted', nullable: true })
  @DeleteDateColumn({ type: 'timestamp with time zone', nullable: true })
  deletedAt?: Date;

  @ApiProperty({ type: () => [FeedbackComment], description: 'List of comments associated with this feedback entry' })
  @OneToMany(() => FeedbackComment, (comment) => comment.feedback, { cascade: true })
  comments: FeedbackComment[];
}`
}
