import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentStatus } from './entities/document.entity';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  create(payload: Partial<Document>): Promise<Document> {
    const document = this.documentRepository.create(payload);
    return this.documentRepository.save(document);
  }

  findById(id: string): Promise<Document | null> {
    return this.documentRepository.findOne({ where: { id } });
  }

  findByOwner(ownerId: string): Promise<Document[]> {
    return this.documentRepository.find({ where: { ownerId } });
  }

  findByFileHash(fileHash: string): Promise<Document | null> {
    return this.documentRepository.findOne({ where: { fileHash } });
  }

  async updateStatus(id: string, status: DocumentStatus): Promise<Document | null> {
    await this.documentRepository.update(id, { status });
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.documentRepository.delete(id);
  }
}
