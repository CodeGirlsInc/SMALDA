import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cmmty_webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  url: string;

  @Column({ type: 'simple-json' })
  events: string[];

  @Column()
  secret: string;

  @Column({ default: true })
  isActive: boolean;

  @Column()
  userId: string;
}
