import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('access_logs')
export class AccessLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @Column()
  routePath: string;

  @Column()
  httpMethod: string;

  @Column({ nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  @Index('idx_access_logs_created_at')
  createdAt: Date;

  @Column({ type: 'int', nullable: true })
  statusCode: number;
}
