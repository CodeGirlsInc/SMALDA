{
  ;`import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Feedback } from './feedback.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('feedback_comments')
export class FeedbackComment {
  @ApiProperty({ description: 'Unique identifier for the comment' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'The text content of the comment' })
  @Column({ type: 'text' })
  commentText: string;

  @ApiProperty({ description: 'ID of the user who made the comment', format: 'uuid' })
  @Column({ type: 'uuid' })
  userId: string; // User who made the comment

  @ApiProperty({ description: 'Timestamp when the comment was created' })
  @CreateDateColumn({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp when the comment was last updated' })
  @UpdateDateColumn({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @ApiProperty({ type: () => Feedback, description: 'The feedback entry this comment belongs to' })
  @ManyToOne(() => Feedback, (feedback) => feedback.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'feedbackId' }) // This column will store the foreign key
  feedback: Feedback;

  @ApiProperty({ description: 'Foreign key to the feedback entry', format: 'uuid' })
  @Column({ type: 'uuid' })
  feedbackId: string; // Explicit foreign key column
}`
}
