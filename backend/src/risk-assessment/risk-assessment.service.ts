import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import { DocumentsService } from '../documents/documents.service';
import { Document } from '../documents/entities/document.entity';

export enum RiskFlag {
  MISSING_PARCEL_ID = 'MISSING_PARCEL_ID',
  OVERLAPPING_CLAIM = 'OVERLAPPING_CLAIM',
  FORGED_SIGNATURE_INDICATOR = 'FORGED_SIGNATURE_INDICATOR',
  EXPIRED_DOCUMENT = 'EXPIRED_DOCUMENT',
  INCOMPLETE_OWNERSHIP_CHAIN = 'INCOMPLETE_OWNERSHIP_CHAIN',
  UNKNOWN_ISSUER = 'UNKNOWN_ISSUER',
}

export interface RiskResult {
  score: number;
  flags: RiskFlag[];
}

const FLAG_WEIGHTS: Record<RiskFlag, number> = {
  [RiskFlag.MISSING_PARCEL_ID]: 20,
  [RiskFlag.OVERLAPPING_CLAIM]: 20,
  [RiskFlag.FORGED_SIGNATURE_INDICATOR]: 25,
  [RiskFlag.EXPIRED_DOCUMENT]: 15,
  [RiskFlag.INCOMPLETE_OWNERSHIP_CHAIN]: 10,
  [RiskFlag.UNKNOWN_ISSUER]: 10,
};

@Injectable()
export class RiskAssessmentService {
  constructor(
    private readonly documentsService: DocumentsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async assessDocument(documentId: string): Promise<RiskResult> {
    const document = await this.documentsService.findById(documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const flags = await this.detectFlags(document);
    const score = this.calculateScore(flags);

    await this.documentsService.updateRisk(documentId, score, flags);
    // Invalidate cached risk result for this document
    await this.cacheManager.del(`document-risk:${documentId}`);

    return { score, flags };
  }

  private async detectFlags(document: Document): Promise<RiskFlag[]> {
    const flags: RiskFlag[] = [];

    if (!document.title || !/\d/.test(document.title)) {
      flags.push(RiskFlag.MISSING_PARCEL_ID);
    }

    const ownerDocuments = await this.documentsService.findByOwner(document.ownerId);
    if (ownerDocuments.some((doc) => doc.id !== document.id)) {
      flags.push(RiskFlag.OVERLAPPING_CLAIM);
    }

    if (
      document.mimeType === 'application/pdf' &&
      document.fileSize !== undefined &&
      document.fileSize < 50_000
    ) {
      flags.push(RiskFlag.FORGED_SIGNATURE_INDICATOR);
    }

    if (document.title?.toLowerCase().includes('expired')) {
      flags.push(RiskFlag.EXPIRED_DOCUMENT);
    }

    if (!document.title || document.title.trim().length < 12) {
      flags.push(RiskFlag.INCOMPLETE_OWNERSHIP_CHAIN);
    }

    if (!document.title?.toLowerCase().includes('issued')) {
      flags.push(RiskFlag.UNKNOWN_ISSUER);
    }

    return Array.from(new Set(flags));
  }

  private calculateScore(flags: RiskFlag[]): number {
    const rawScore = flags.reduce((total, flag) => total + (FLAG_WEIGHTS[flag] ?? 0), 0);
    return Math.min(100, Math.max(0, rawScore));
  }
}
