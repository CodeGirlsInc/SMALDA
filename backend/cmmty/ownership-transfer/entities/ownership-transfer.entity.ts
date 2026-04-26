import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Document } from '../../../src/documents/entities/document.entity';
import { User } from '../../../src/users/entities/user.entity';

@Entity('ownership_transfers')
export class OwnershipTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  document: Document;

  @Column({ name: 'from_user_id' })
  fromUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  fromUser: User;

  @Column({ name: 'to_user_id' })
  toUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  toUser: User;

  @CreateDateColumn({ name: 'transferred_at' })
  transferredAt: Date;
}
