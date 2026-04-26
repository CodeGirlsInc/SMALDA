import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { Document, DocumentStatus } from '../../src/documents/entities/document.entity';
import { DocumentSearchQueryDto } from './dto/document-search-query.dto';

export interface PaginatedDocuments {
  data: Document[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class DocumentSearchService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  async search(dto: DocumentSearchQueryDto): Promise<PaginatedDocuments> {
    const { q, status, minScore, maxScore, from, to, page = 1, limit = 10 } = dto;

    const queryBuilder = this.documentRepository.createQueryBuilder('document');

    // Partial title matching with ILIKE
    if (q) {
      queryBuilder.andWhere('document.title ILIKE :q', { q: `%${q}%` });
    }

    // Filter by status
    if (status) {
      queryBuilder.andWhere('document.status = :status', { status });
    }

    // Filter by risk score range
    if (minScore !== undefined) {
      queryBuilder.andWhere('document.riskScore >= :minScore', { minScore });
    }

    if (maxScore !== undefined) {
      queryBuilder.andWhere('document.riskScore <= :maxScore', { maxScore });
    }

    // Filter by date range
    if (from) {
      queryBuilder.andWhere('document.createdAt >= :from', { from: new Date(from) });
    }

    if (to) {
      queryBuilder.andWhere('document.createdAt <= :to', { to: new Date(to) });
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit).orderBy('document.createdAt', 'DESC');

    const data = await queryBuilder.getMany();

    return {
      data,
      total,
      page,
      limit,
    };
  }
}