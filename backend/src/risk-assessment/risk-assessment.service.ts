import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import { DocumentsService } from '../documents/documents.service';
import { Document } from '../documents/entities/document.entity';
import { RiskAssessmentResponseDto } from './dto/risk-assessment-response.dto';

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

const KNOWN_ISSUERS = [
  'land registry',
  'ministry of lands',
  'surveyor general',
  'lands commission',
  'deeds office',
];
const SIGNATURE_KEYWORDS = ['signed', 'signature', 'authorized by', 'notarized', 'certified'];
const PARCEL_PATTERN = /\b(?:parcel|lot|plot|block)\s*(?:no\.?|number|#)?\s*[\w\d-]+/i;
const PARCEL_ID_PATTERN = /\b[\w]{2,6}[-/]\d{3,10}\b/;

@Injectable()
export class RiskAssessmentService {
  constructor(
    private readonly documentsService: DocumentsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async assessDocument(documentId: string): Promise<RiskAssessmentResponseDto> {
    const document = await this.documentsService.findById(documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const flags = await this.detectFlags(document);
    const score = this.calculateScore(flags);

    await this.documentsService.updateRisk(documentId, score, flags);
    await this.cacheManager.del(`document-risk:${documentId}`);

    return {
      documentId,
      riskScore: score,
      riskFlags: flags,
      assessedAt: new Date(),
    };
  }

  async extractTextContent(document: Document): Promise<string> {
    if (document.mimeType !== 'application/pdf') return '';
    try {
      const buffer = fs.readFileSync(document.filePath);
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch {
      return '';
    }
  }

  private async detectFlags(document: Document): Promise<RiskFlag[]> {
    const flags: RiskFlag[] = [];

    const text = await this.extractTextContent(document);
    const textLower = text.toLowerCase();

    // MISSING_PARCEL_ID: no parcel pattern in text or digits in title
    const hasParcelInText = PARCEL_PATTERN.test(text) || PARCEL_ID_PATTERN.test(text);
    const hasParcelInTitle = /\d/.test(document.title ?? '');
    if (!hasParcelInText && !hasParcelInTitle) {
      flags.push(RiskFlag.MISSING_PARCEL_ID);
    }

    // OVERLAPPING_CLAIM: duplicate parcel ID found in DB
    const parcelMatch = text.match(PARCEL_ID_PATTERN);
    if (parcelMatch) {
      const duplicate = await this.documentsService.findByParcelId(parcelMatch[0], document.id);
      if (duplicate) flags.push(RiskFlag.OVERLAPPING_CLAIM);
    } else {
      const ownerDocuments = await this.documentsService.findByOwner(document.ownerId);
      if (ownerDocuments.some((doc) => doc.id !== document.id)) {
        flags.push(RiskFlag.OVERLAPPING_CLAIM);
      }
    }

    // FORGED_SIGNATURE_INDICATOR: content-integrity check (missing signature keywords)
    if (document.mimeType === 'application/pdf') {
      const hasSignature = SIGNATURE_KEYWORDS.some((kw) => textLower.includes(kw));
      if (!hasSignature) flags.push(RiskFlag.FORGED_SIGNATURE_INDICATOR);
    }

    // EXPIRED_DOCUMENT
    if (document.title?.toLowerCase().includes('expired') || textLower.includes('expired')) {
      flags.push(RiskFlag.EXPIRED_DOCUMENT);
    }

    // INCOMPLETE_OWNERSHIP_CHAIN
    if (!document.title || document.title.trim().length < 12) {
      flags.push(RiskFlag.INCOMPLETE_OWNERSHIP_CHAIN);
    }

    // UNKNOWN_ISSUER: check text for known issuer names or title fallback
    const hasKnownIssuer = KNOWN_ISSUERS.some((issuer) => textLower.includes(issuer));
    if (!hasKnownIssuer && !document.title?.toLowerCase().includes('issued')) {
      flags.push(RiskFlag.UNKNOWN_ISSUER);
    }

    return Array.from(new Set(flags));
  }

  calculateScore(flags: RiskFlag[]): number {
    const rawScore = flags.reduce((total, flag) => total + (FLAG_WEIGHTS[flag] ?? 0), 0);
    return Math.min(100, Math.max(0, rawScore));
  }
}
