import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('dispute_reasons')
export class DisputeReason {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;
}
