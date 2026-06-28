import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../documents/entities/document.entity';
import { DocumentAnalysisResult, ExtractedEntity, DateEntity, OverlapResult } from './interfaces/analysis-result.interface';

const DATE_PATTERNS = [
  /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/g,
  /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g,
  /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/g,
];

const ENTITY_PATTERNS: { type: ExtractedEntity['type']; patterns: RegExp[] }[] = [
  {
    type: 'owner',
    patterns: [
      /\b(?:Owner|Owner Name|Property Of|Registered To)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
      /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:is the|is designated as)/g,
    ],
  },
  {
    type: 'issuer',
    patterns: [
      /\b(?:Issued By|Issuer|Authority|Department Of)[:\s]+([A-Z][a-zA-Z\s]+)/g,
      /\b(?:County|State|Federal|City|Government)\s+([A-Z][a-zA-Z\s]+?)(?:Department|Office|Division)/g,
    ],
  },
  {
    type: 'parcel',
    patterns: [
      /\b(?:Parcel|Parcel ID|APN|PIN|Tax ID)[:\s]+([A-Z0-9\-]+)/g,
      /\b(\d{2,3}[-/]\d{2,3}[-/]\d{3,4})\b/g,
    ],
  },
];

@Injectable()
export class DocumentAnalysisService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  async analyze(documentId: string, extractedText?: string): Promise<DocumentAnalysisResult> {
    const document = await this.documentRepository.findOne({ where: { id: documentId } });
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    const text = extractedText || document.title || '';

    const entities = this.extractEntities(text);
    const dates = this.extractDates(text);
    const overlaps = await this.detectOverlaps(document, text);
    const analysisText = this.buildAnalysisText(entities, dates);

    return { entities, dates, overlaps, extractedText: analysisText };
  }

  private extractEntities(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    for (const { type, patterns } of ENTITY_PATTERNS) {
      for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          const value = match[1]?.trim();
          if (value) {
            entities.push({
              type,
              value,
              confidence: type === 'parcel' ? 0.9 : 0.7,
            });
          }
        }
      }
    }

    return entities;
  }

  private extractDates(text: string): DateEntity[] {
    const dates: DateEntity[] = [];

    for (const pattern of DATE_PATTERNS) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const raw = match[0];
        const parsed = new Date(raw);
        if (!isNaN(parsed.getTime())) {
          const role = this.inferDateRole(raw, text);
          dates.push({ raw, parsed, role });
        }
      }
    }

    return dates;
  }

  private inferDateRole(raw: string, context: string): DateEntity['role'] {
    const before = context.substring(0, context.indexOf(raw)).slice(-60).toLowerCase();
    if (before.includes('expir') || before.includes('valid until') || before.includes('expires')) {
      return 'expiry';
    }
    if (before.includes('sign') || before.includes('signed') || before.includes('executed')) {
      return 'signing';
    }
    return 'issued';
  }

  isExpired(date: DateEntity): boolean {
    if (date.role !== 'expiry') return false;
    return date.parsed < new Date();
  }

  private async detectOverlaps(source: Document, sourceText: string): Promise<OverlapResult[]> {
    const candidates = await this.documentRepository.find({
      where: { ownerId: source.ownerId },
    });

    const overlaps: OverlapResult[] = [];
    const tokens = this.tokenize(sourceText);

    for (const candidate of candidates) {
      if (candidate.id === source.id) continue;
      const candidateText = candidate.title || '';
      const candidateTokens = this.tokenize(candidateText);
      const similarity = this.cosineSimilarity(tokens, candidateTokens);
      if (similarity > 0.3) {
        overlaps.push({ documentId: candidate.id, similarity });
      }
    }

    return overlaps.sort((a, b) => b.similarity - a.similarity);
  }

  private tokenize(text: string): Map<string, number> {
    const freq = new Map<string, number>();
    const words = text.toLowerCase().split(/\W+/).filter(Boolean);
    for (const word of words) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }
    return freq;
  }

  private cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0, normA = 0, normB = 0;

    for (const [word, count] of a) {
      normA += count * count;
      dot += count * (b.get(word) || 0);
    }

    for (const count of b.values()) {
      normB += count * count;
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  private buildAnalysisText(entities: ExtractedEntity[], dates: DateEntity[]): string {
    const parts: string[] = [];

    for (const entity of entities) {
      parts.push(`${entity.type}: ${entity.value}`);
    }

    for (const date of dates) {
      const status = date.role === 'expiry' && this.isExpired(date) ? ' (EXPIRED)' : '';
      parts.push(`${date.role}: ${date.parsed.toISOString()}${status}`);
    }

    return parts.join('\n');
  }
}
