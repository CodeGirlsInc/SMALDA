import { User } from 'src/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ApiKeyStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  keyHash: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column()
  prefix: string; // First 8 characters for identification

  @Column({
    type: 'enum',
    enum: ApiKeyStatus,
    default: ApiKeyStatus.ACTIVE,
  })
  status: ApiKeyStatus;

  @Column({ nullable: true })
  expiresAt?: Date;

  @Column({ nullable: true })
  lastUsedAt?: Date;

  @Column({ default: 0 })
  usageCount: number;

  @Column({ nullable: true })
  revokedAt?: Date;

  @Column({ nullable: true })
  revokedReason?: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
