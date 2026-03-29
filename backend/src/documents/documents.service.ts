import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentStatus } from './entities/document.entity';
import { PaginatedDocumentsDto } from './dto/document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';

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

  async updateRisk(
    id: string,
    score: number,
    flags: string[],
  ): Promise<Document | null> {
    await this.documentRepository.update(id, {
      riskScore: score,
      riskFlags: flags,
    });
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.documentRepository.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    await this.documentRepository.delete(id);
  }

  async restore(id: string): Promise<void> {
    await this.documentRepository.restore(id);
  }

  findByIdIncludingDeleted(id: string): Promise<Document | null> {
    return this.documentRepository.findOne({ 
      where: { id }, 
      withDeleted: true 
    });
  }

  findByOwnerIncludingDeleted(ownerId: string): Promise<Document[]> {
    return this.documentRepository.find({ 
      where: { ownerId }, 
      withDeleted: true 
    });
  }

  async findWithFilters(
    filters: QueryDocumentsDto,
    requestingUserId: string,
    isAdmin: boolean,
  ): Promise<PaginatedDocumentsDto> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const qb = this.documentRepository
      .createQueryBuilder('document')
      .orderBy('document.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    // Scope: regular users only see their own documents
    if (!isAdmin) {
      qb.andWhere('document.owner_id = :ownerId', { ownerId: requestingUserId });
    }

    if (filters.status) {
      qb.andWhere('document.status = :status', { status: filters.status });
    }

    if (filters.min_risk_score !== undefined) {
      qb.andWhere('document.risk_score >= :minRiskScore', { minRiskScore: filters.min_risk_score });
    }

    if (filters.max_risk_score !== undefined) {
      qb.andWhere('document.risk_score <= :maxRiskScore', { maxRiskScore: filters.max_risk_score });
    }

    if (filters.from_date) {
      qb.andWhere('document.created_at >= :fromDate', { fromDate: new Date(filters.from_date) });
    }

    if (filters.to_date) {
      qb.andWhere('document.created_at <= :toDate', { toDate: new Date(filters.to_date) });
    }

    if (filters.search) {
      qb.andWhere('LOWER(document.title) LIKE :search', {
        search: `%${filters.search.toLowerCase()}%`,
      });
    }

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }
}
