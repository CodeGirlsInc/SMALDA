import { Injectable, NotFoundException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../documents/entities/document.entity';

const FLAG_DESCRIPTIONS: Record<string, { description: string; action: string }> = {
  duplicate: { description: 'This document appears to be a duplicate of an existing record.', action: 'Verify the document is unique before proceeding.' },
  tampered: { description: 'Signs of document tampering were detected.', action: 'Obtain a certified original copy.' },
  expired: { description: 'The document may be expired or outdated.', action: 'Renew or replace the document.' },
};

@Injectable()
export class RiskReportService {
  constructor(@InjectRepository(Document) private readonly docs: Repository<Document>) {}

  async generateReport(documentId: string, userId: string) {
    const doc = await this.docs.findOneBy({ id: documentId });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.ownerId !== userId) throw new ForbiddenException();
    if (doc.riskScore == null) throw new UnprocessableEntityException('Document has not been risk-assessed yet');
    const riskLevel = doc.riskScore < 30 ? 'LOW' : doc.riskScore < 70 ? 'MEDIUM' : 'HIGH';
    const flagDetails = (doc.riskFlags ?? []).map((flag) => ({
      flag,
      ...(FLAG_DESCRIPTIONS[flag] ?? { description: flag, action: 'Review this flag with an administrator.' }),
    }));
    return { documentId, title: doc.title, riskScore: doc.riskScore, riskLevel, flagDetails };
  }
}