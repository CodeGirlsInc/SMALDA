import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Column } from 'typeorm';
import { Document } from '../../src/documents/entities/document.entity';

@Entity('cmmty_document_shares')
export class DocumentShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  documentId: string;

  @Column()
  sharedWithUserId: string;

  @Column()
  sharedByUserId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;
}
