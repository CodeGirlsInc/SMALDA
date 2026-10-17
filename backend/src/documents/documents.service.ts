import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  LessThanOrEqual,
  MoreThanOrEqual,
  ILike,
} from 'typeorm';
import { promises as fs } from 'fs';
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
    return this.documentRepository.findOne({ where: Object.assign({ fileHash }, ownerId ? { ownerId } : {}) });
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

  async revokeAccess(id: string): Promise<Document | null> {
    await this.documentRepository.update(id, {
      status: DocumentStatus.REJECTED,
      archived: true,
    });
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const document = await this.documentRepository.findOne({ where: { id } });
    if (document) {
      // Remove the stored file so no orphaned blob outlives its record.
      await fs.unlink(document.filePath).catch(() => undefined);
    }
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
