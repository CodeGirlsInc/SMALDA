import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { StellarTransaction } from './stellar-transaction.entity';

@Entity('stellar_accounts')
export class StellarAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  publicKey: string;

  @Column()
  encryptedSecretKey: string;

  @Column({
    type: 'enum',
    enum: ['testnet', 'mainnet']
  })
  network: string;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  balance: string;

  @Column({ default: false })
  isFunded: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastFundedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  accountData: any;

  @OneToMany(() => StellarTransaction, transaction => transaction.sourceAccount)
  transactions: StellarTransaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
