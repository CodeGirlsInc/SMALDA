import { Entity, PrimaryGeneratedColumn, Column, Unique, CreateDateColumn } from 'typeorm';

@Entity('glossary_terms')
@Unique(['term'])
export class GlossaryTerm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  term: string;

  @Column({ type: 'text', nullable: true })
  definition: string;

  @CreateDateColumn()
  createdAt: Date;
}
