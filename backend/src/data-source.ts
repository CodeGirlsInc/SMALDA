import { DataSource } from 'typeorm';
import { User } from './users/entities/user.entity';
import { Document } from './documents/entities/document.entity';
import { VerificationRecord } from './verification/entities/verification-record.entity';
import { Transfer } from './transfers/entities/transfer.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [User, Document, VerificationRecord, Transfer],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: false,
});
