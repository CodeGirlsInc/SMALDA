import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  TIMEOUT = 'timeout'
}

export enum NetworkType {
  TESTNET = 'testnet',
  MAINNET = 'mainnet'
}

@Entity('stellar_transactions')
@Index(['documentHash', 'network'])
@Index(['status'])
@Index(['createdAt'])
export class StellarTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  transactionHash: string;

  @Column()
  documentHash: string;

  @Column({ nullable: true })
  memo: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING
  })
  status: TransactionStatus;

  @Column({
    type: 'enum',
    enum: NetworkType
  })
  network: NetworkType;

  @Column({ type: 'decimal', precision: 20, scale: 7, nullable: true })
  fee: string;

  @Column({ nullable: true })
  sourceAccount: string;

  @Column({ nullable: true })
  destinationAccount: string;

  @Column({ type: 'text', nullable: true })
  transactionData: string;

  @Column({ type: 'text', nullable: true })
  errorData: string;

  @Column({ nullable: true })
  horizonUrl: string;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
