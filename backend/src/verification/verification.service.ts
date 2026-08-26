import { ConflictException, Injectable } from '@nestjs/common';
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

  async create(payload: Partial<VerificationRecord>): Promise<VerificationRecord> {
    if (payload.status === VerificationStatus.CONFIRMED) {
      const existing = await this.verificationRepository.findOne({
        where: {
          documentId: payload.documentId,
          status: VerificationStatus.CONFIRMED,
        },
      });

      if (existing) {
        throw new ConflictException(
          'Document already has an active verification record',
        );
      }
    }

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

  async updateStatus(
    id: string,
    status: VerificationStatus,
  ): Promise<VerificationRecord | null> {
    await this.verificationRepository.update(id, { status });
    return this.verificationRepository.findOne({ where: { id } });
  }
}
