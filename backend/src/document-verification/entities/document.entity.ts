import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DocumentStatus } from '../enums/document-status.enum';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text', { nullable: true })
  description: string;

  @Column()
  submittedBy: string;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.SUBMITTED,
  })
  status: DocumentStatus;

  @Column('text', { nullable: true })
  rejectionReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
