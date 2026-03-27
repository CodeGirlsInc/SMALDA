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

  async updateStatus(id: string, status: VerificationStatus): Promise<VerificationRecord | null> {
    await this.verificationRepository.update(id, { status });
    return this.verificationRepository.findOne({ where: { id } });
  }
}
