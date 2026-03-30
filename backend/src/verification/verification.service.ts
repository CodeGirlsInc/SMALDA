import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  VerificationRecord,
  VerificationStatus,
} from './entities/verification-record.entity';

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(VerificationRecord)
    private readonly verificationRepository: Repository<VerificationRecord>,
  ) {}

  create(payload: Partial<VerificationRecord>): Promise<VerificationRecord> {
    const record = this.verificationRepository.create(payload);
    return this.verificationRepository.save(record);
  }

  findByDocument(documentId: string): Promise<VerificationRecord[]> {
    return this.verificationRepository.find({ where: { documentId } });
  }

  findLatestByDocument(documentId: string): Promise<VerificationRecord | null> {
    return this.verificationRepository.findOne({
      where: { documentId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, status: VerificationStatus): Promise<VerificationRecord | null> {
    await this.verificationRepository.update(id, { status });
    return this.verificationRepository.findOne({ where: { id } });
  }

  async softDelete(id: string): Promise<void> {
    await this.verificationRepository.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    await this.verificationRepository.delete(id);
  }

  async restore(id: string): Promise<void> {
    await this.verificationRepository.restore(id);
  }

  findByDocumentIncludingDeleted(documentId: string): Promise<VerificationRecord[]> {
    return this.verificationRepository.find({ 
      where: { documentId }, 
      withDeleted: true 
    });
  }

  findLatestByDocumentIncludingDeleted(documentId: string): Promise<VerificationRecord | null> {
    return this.verificationRepository.findOne({
      where: { documentId },
      order: { createdAt: 'DESC' },
      withDeleted: true,
    });
  }

  async hardDeleteByDocument(documentId: string): Promise<void> {
    const records = await this.findByDocumentIncludingDeleted(documentId);
    for (const record of records) {
      await this.hardDelete(record.id);
    }
  }

  async findAll(page: number, limit: number): Promise<{ data: VerificationRecord[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.verificationRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findAllWithFilters(filters: {
    status?: VerificationStatus;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: VerificationRecord[]; total: number; page: number; limit: number }> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);

    const qb = this.verificationRepository
      .createQueryBuilder('v')
      .orderBy('v.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.status) {
      qb.andWhere('v.status = :status', { status: filters.status });
    }
    if (filters.from) {
      qb.andWhere('v.created_at >= :from', { from: new Date(filters.from) });
    }
    if (filters.to) {
      qb.andWhere('v.created_at <= :to', { to: new Date(filters.to) });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
}
