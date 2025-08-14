// src/dispute-reason-classifier/entities/dispute-reason.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('dispute_reasons')
export class DisputeReason {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description?: string;
}
