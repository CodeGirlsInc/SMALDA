import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  VerificationRecord,
  VerificationStatus,
} from './entities/verification-record.entity';
import { DocumentsGateway } from '../documents/documents.gateway';

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(VerificationRecord)
    private readonly verificationRepository: Repository<VerificationRecord>,
    private readonly documentsGateway: DocumentsGateway,
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

    const record = await this.verificationRepository.save(payload);
    this.documentsGateway.notifyVerificationStatusChanged(
      record.documentId,
      record.status,
      null,
    );
    return record;
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
    const before = await this.verificationRepository.findOne({ where: { id } });
    await this.verificationRepository.update(id, { status });
    const record = await this.verificationRepository.findOne({ where: { id } });

    if (record) {
      this.documentsGateway.notifyVerificationStatusChanged(
        record.documentId,
        record.status,
        before?.status ?? null,
      );
    }
    return record;
  }
}