import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('webhook_deliveries')
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  subscriptionId: string;

  @Column()
  event: string;

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({ type: 'int', nullable: true })
  responseStatus: number | null;

  @Column({ nullable: true })
  deliveredAt: Date;

  @Column({ default: false })
  success: boolean;

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;
}