import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LandRecordStatus } from '../enums/land-record.enum';

@Entity('land_records')
@Index(['parcelId'], { unique: true })
@Index(['status'])
export class LandRecord {
  @ApiProperty({ description: 'Unique identifier (UUID)' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Unique parcel identifier assigned by a land registry' })
  @Column({ unique: true })
  parcelId: string;

  @ApiProperty({ description: 'Human-readable address or coordinates of the parcel' })
  @Column()
  location: string;

  @ApiProperty({ description: 'Land area in square meters', example: 500.75 })
  @Column({ type: 'decimal', precision: 12, scale: 4 })
  area: number;

  @ApiProperty({ description: 'Full name of the current owner' })
  @Column()
  ownerName: string;

  @ApiPropertyOptional({ description: 'Phone number or email address of the owner' })
  @Column({ nullable: true, default: null })
  ownerContact: string | null;

  @ApiProperty({ description: 'Date the parcel was officially registered', example: '2024-01-15' })
  @Column({ type: 'date' })
  registrationDate: Date;

  @ApiProperty({ enum: LandRecordStatus, description: 'Current status of the land record' })
  @Column({ type: 'enum', enum: LandRecordStatus, default: LandRecordStatus.ACTIVE })
  status: LandRecordStatus;

  @ApiProperty({ description: 'Timestamp when the record was created' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp when the record was last updated' })
  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
