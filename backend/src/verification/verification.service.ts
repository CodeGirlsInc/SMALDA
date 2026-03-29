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
    // Find all verification records for this document (including soft-deleted ones)
    const records = await this.findByDocumentIncludingDeleted(documentId);
    
    // Hard delete each record
    for (const record of records) {
      await this.hardDelete(record.id);
    }
  }
}
