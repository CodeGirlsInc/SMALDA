import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('land_records')
export class LandRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  parcelNumber: string;

  @Column()
  ownerName: string;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  sizeInSqMeters: number;

  @CreateDateColumn()
  createdAt: Date;
}