import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Document } from '../../documents/entities/document.entity';

export enum ShareInviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REVOKED = 'revoked',
}

@Entity('share_invites')
export class ShareInvite {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'document_id' }) documentId: string;
  @Column({ name: 'invited_email' }) invitedEmail: string;
  @Column({ name: 'invited_by_id' }) invitedById: string;
  @Column({ type: 'enum', enum: ShareInviteStatus, default: ShareInviteStatus.PENDING }) status: ShareInviteStatus;
  @Column({ nullable: true, name: 'accepted_by_user_id' }) acceptedByUserId?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @ManyToOne(() => User) document?: any;
  @ManyToOne(() => User) invitedBy?: any;
  @ManyToOne(() => User) acceptedBy?: any;
  @ManyToOne(() => Document) documentRef?: any;
}
