import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum IpRuleType {
  ALLOW = 'ALLOW',
  BLOCK = 'BLOCK',
}

@Entity('ip_rules')
export class IpRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  cidr: string;

  @Column({
    type: 'enum',
    enum: IpRuleType,
  })
  type: IpRuleType;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
