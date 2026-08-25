import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
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

  async findByOwnerPaginated(
    ownerId: string,
    page: number,
    limit: number,
    status?: DocumentStatus,
  ): Promise<{ data: Document[]; total: number; page: number; limit: number }> {
    const where: any = { ownerId };
    if (status) {
      where.status = status;
    }

    const [data, total] = await this.documentRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, total, page, limit };
  }

  findByFileHash(fileHash: string): Promise<Document | null> {
    return this.documentRepository.findOne({ where: { fileHash } });
  }

  async updateStatus(
    id: string,
    status: DocumentStatus,
  ): Promise<Document | null> {
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
    await this.documentRepository.delete(id);
  }

  findAllWithCoordinates(): Promise<Document[]> {
    return this.documentRepository
      .createQueryBuilder('document')
      .where('document.latitude IS NOT NULL')
      .andWhere('document.longitude IS NOT NULL')
      .getMany();
  }

  async findByRiskFilters(filters: {
    page: number;
    limit: number;
    minScore?: number;
    maxScore?: number;
    startDate?: Date;
    endDate?: Date;
    sortOrder: 'ASC' | 'DESC';
  }): Promise<{ data: Document[]; total: number }> {
    const qb = this.documentRepository.createQueryBuilder('document');

    qb.where('document.risk_score IS NOT NULL');

    if (filters.minScore !== undefined) {
      qb.andWhere('document.risk_score >= :minScore', {
        minScore: filters.minScore,
      });
    }

    if (filters.maxScore !== undefined) {
      qb.andWhere('document.risk_score <= :maxScore', {
        maxScore: filters.maxScore,
      });
    }

    if (filters.startDate) {
      qb.andWhere('document.created_at >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      qb.andWhere('document.created_at <= :endDate', {
        endDate: filters.endDate,
      });
    }

    qb.orderBy('document.risk_score', filters.sortOrder);
    qb.skip((filters.page - 1) * filters.limit);
    qb.take(filters.limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }
}
