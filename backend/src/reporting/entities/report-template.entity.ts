import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ReportType, ReportFormat } from './report.entity';

@Entity('report_templates')
@Index(['type'])
@Index(['isActive'])
export class ReportTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ReportType,
  })
  type: ReportType;

  @Column({
    type: 'enum',
    enum: ReportFormat,
    array: true,
    default: ['pdf', 'csv'],
  })
  supportedFormats: ReportFormat[];

  @Column({ type: 'jsonb' })
  config: {
    columns?: string[];
    charts?: any[];
    filters?: any[];
    styling?: any;
    layout?: string;
  };

  @Column({ type: 'text', nullable: true })
  queryTemplate: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isSystem: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
