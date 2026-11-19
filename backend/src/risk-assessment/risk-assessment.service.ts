import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';

import { DocumentsService } from '../documents/documents.service';
import { Document } from '../documents/entities/document.entity';
import { extractTextFromPdfBuffer } from './pdf-text-extractor';

export enum RiskFlag {
  MISSING_PARCEL_ID = 'MISSING_PARCEL_ID',
  OVERLAPPING_CLAIM = 'OVERLAPPING_CLAIM',
  FORGED_SIGNATURE_INDICATOR = 'FORGED_SIGNATURE_INDICATOR',
  EXPIRED_DOCUMENT = 'EXPIRED_DOCUMENT',
  INCOMPLETE_OWNERSHIP_CHAIN = 'INCOMPLETE_OWNERSHIP_CHAIN',
  UNKNOWN_ISSUER = 'UNKNOWN_ISSUER',
}

export const RISK_FLAG_DESCRIPTIONS: Record<RiskFlag, Record<string, string>> = {
  [RiskFlag.MISSING_PARCEL_ID]: {
    en: 'No parcel identifier (APN/PIN) was found in the document.',
    fr: "Aucun identifiant de parcelle (APN/PIN) n'a été trouvé dans le document.",
    es: 'No se encontró ningún identificador de parcela (APN/PIN) en el documento.',
  },
  [RiskFlag.OVERLAPPING_CLAIM]: {
    en: 'This document covers land already claimed by another filing.',
    fr: 'Ce document couvre un terrain déjà revendiqué par une autre déclaration.',
    es: 'Este documento cubre tierras ya reclamadas por otra declaración.',
  },
  [RiskFlag.FORGED_SIGNATURE_INDICATOR]: {
    en: 'Heuristic analysis suggests the signature may have been forged.',
    fr: "L'analyse heuristique suggère que la signature a pu être falsifiée.",
    es: 'El análisis heurístico sugiere que la firma puede haber sido falsificada.',
  },
  [RiskFlag.EXPIRED_DOCUMENT]: {
    en: 'The document has passed its stated expiry or validity date.',
    fr: 'Le document a dépassé sa date d\'expiration ou de validité.',
    es: 'El documento ha pasado su fecha de vencimiento o validez.',
  },
  [RiskFlag.INCOMPLETE_OWNERSHIP_CHAIN]: {
    en: 'The ownership chain is incomplete or the title is too short.',
    fr: 'La chaîne de propriété est incomplète ou le titre est trop court.',
    es: 'La cadena de propiedad está incompleta o el título es demasiado corto.',
  },
  [RiskFlag.UNKNOWN_ISSUER]: {
    en: 'The issuing authority could not be verified against known registries.',
    fr: "L'autorité émettrice n'a pas pu être vérifiée auprès des registres connus.",
    es: 'No se pudo verificar la autoridad emisora contra los registros conocidos.',
  },
};

export interface RiskFlagResult {
  flag: RiskFlag;
  description: string;
}

export interface RiskResult {
  score: number;
  flags: RiskFlagResult[];
  contentAnalysisPossible: boolean;
}

const FLAG_WEIGHTS: Record<RiskFlag, number> = {
  [RiskFlag.MISSING_PARCEL_ID]: 20,
  [RiskFlag.OVERLAPPING_CLAIM]: 20,
  [RiskFlag.FORGED_SIGNATURE_INDICATOR]: 25,
  [RiskFlag.EXPIRED_DOCUMENT]: 15,
  [RiskFlag.INCOMPLETE_OWNERSHIP_CHAIN]: 10,
  [RiskFlag.UNKNOWN_ISSUER]: 10,
};

// Configurable list of known issuers - can be overridden via env variable
const DEFAULT_KNOWN_ISSUERS = [
  'land registry',
  'county recorder',
  'registry of deeds',
  'bureau of land management',
  'city clerk',
  'town clerk',
];

@Injectable()
export class RiskAssessmentService {
  private readonly logger = new Logger(RiskAssessmentService.name);
  private readonly knownIssuers: string[];

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly configService: ConfigService,
  ) {
    // Load known issuers from config or use defaults
    const configuredIssuers = this.configService.get<string>(
      'KNOWN_ISSUERS',
      '',
    );
    this.knownIssuers = configuredIssuers
      ? configuredIssuers.split(',').map((i) => i.trim().toLowerCase())
      : DEFAULT_KNOWN_ISSUERS;
  }

  async assessDocument(documentId: string, lang?: string): Promise<RiskResult> {
    const document = await this.documentsService.findById(documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const { flags, contentAnalysisPossible } = await this.detectFlags(document);
    const score = this.calculateScore(flags);

    await this.documentsService.updateRisk(documentId, score, flags);

    const locale = lang || 'en';
    const flagResults: RiskFlagResult[] = flags.map((flag) => ({
      flag,
      description: RISK_FLAG_DESCRIPTIONS[flag]?.[locale] || RISK_FLAG_DESCRIPTIONS[flag]?.['en'] || flag,
    }));

    return {
      score,
      flags: flagResults,
      contentAnalysisPossible,
    };
  }

  async getStoredAssessment(
    documentId: string,
    lang?: string,
  ): Promise<RiskResult> {
    const document = await this.documentsService.findById(documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const locale = lang || 'en';
    const flags = (document.riskFlags ?? []) as unknown as RiskFlag[];
    let contentAnalysisPossible = false;
    if (document.mimeType === 'application/pdf') {
      const extractedText = await this.extractTextFromPdf(document.filePath);
      contentAnalysisPossible =
        extractedText !== null && extractedText.trim().length > 0;
    }

    return {
      score: document.riskScore ?? 0,
      flags: flags.map((flag) => ({
        flag,
        description:
          RISK_FLAG_DESCRIPTIONS[flag]?.[locale] ||
          RISK_FLAG_DESCRIPTIONS[flag]?.['en'] ||
          flag,
      })),
      contentAnalysisPossible,
    };
  }

  private async detectFlags(
    document: Document,
  ): Promise<{ flags: RiskFlag[]; contentAnalysisPossible: boolean }> {
    const flags: RiskFlag[] = [];
    const isPdf = document.mimeType === 'application/pdf';

    let extractedText: string | null = null;
    if (isPdf) {
      extractedText = await this.extractTextFromPdf(document.filePath);
    }
    const textAvailable =
      extractedText !== null && extractedText.trim().length > 0;

    // MISSING_PARCEL_ID: only judge on text when a real text layer was found.
    // Scanned PDFs have no text layer, so text-based rules must be skipped.
    if (textAvailable) {
      // Parcel number patterns: various formats like "123-456-789", "APN: 12345", "Parcel ID: 123456"
      const parcelPatterns = [
        /\b(?:parcel|apn|pin|account)\s*(?:number|id|#)?[:\s]*\d+[-\s]?\d+[-\s]?\d+\b/i,
        /\b\d{2,3}[-\s]\d{2,3}[-\s]\d{2,4}\b/,
        /\b(?:lot|block)\s+\d+\b/i,
      ];
      const hasParcelId = parcelPatterns.some((pattern) =>
        pattern.test(extractedText!),
      );
      if (!hasParcelId) {
        flags.push(RiskFlag.MISSING_PARCEL_ID);
      }
    } else if (!isPdf) {
      // Fallback to metadata check for non-PDF files
      if (!document.title || !/\d/.test(document.title)) {
        flags.push(RiskFlag.MISSING_PARCEL_ID);
      }
    }

    // OVERLAPPING_CLAIM: Compare coordinates if available
    const hasOverlap = await this.checkCoordinateOverlap(document);
    if (hasOverlap) {
      flags.push(RiskFlag.OVERLAPPING_CLAIM);
    } else if (!document.latitude || !document.longitude) {
      // Fallback to old behavior only if no coordinates
      const ownerDocuments = await this.documentsService.findByOwner(
        document.ownerId,
      );
      if (ownerDocuments.some((doc) => doc.id !== document.id)) {
        flags.push(RiskFlag.OVERLAPPING_CLAIM);
      }
    }

    // FORGED_SIGNATURE_INDICATOR: File size as one signal among others
    // Note: This remains heuristic, not cryptographic, verification
    const fileSizeSuspicious =
      isPdf &&
      document.fileSize !== undefined &&
      document.fileSize < 50_000;

    // Text-derived heuristic: a PDF with only a trivial amount of text.
    let minimalTextSuspicious = false;
    if (textAvailable && document.fileSize !== undefined) {
      minimalTextSuspicious = extractedText!.trim().length < 100;
    }

    if (fileSizeSuspicious || minimalTextSuspicious) {
      flags.push(RiskFlag.FORGED_SIGNATURE_INDICATOR);
    }

    // EXPIRED_DOCUMENT: Parse date/expiry field from extracted text
    if (textAvailable) {
      const isExpired = this.checkExpiryFromText(extractedText!);
      if (isExpired) {
        flags.push(RiskFlag.EXPIRED_DOCUMENT);
      }
    } else if (!isPdf && document.title?.toLowerCase().includes('expired')) {
      // Fallback to title check for non-PDF files
      flags.push(RiskFlag.EXPIRED_DOCUMENT);
    }

    // INCOMPLETE_OWNERSHIP_CHAIN: Keep existing logic
    if (!document.title || document.title.trim().length < 12) {
      flags.push(RiskFlag.INCOMPLETE_OWNERSHIP_CHAIN);
    }

    // UNKNOWN_ISSUER: Match extracted text against known issuers
    if (textAvailable) {
      const issuerFound = this.knownIssuers.some((issuer) =>
        extractedText!.toLowerCase().includes(issuer),
      );
      if (!issuerFound) {
        flags.push(RiskFlag.UNKNOWN_ISSUER);
      }
    } else if (!isPdf && !document.title?.toLowerCase().includes('issued')) {
      // Fallback to title check for non-PDF files
      flags.push(RiskFlag.UNKNOWN_ISSUER);
    }

    return {
      flags: Array.from(new Set(flags)),
      contentAnalysisPossible: isPdf && textAvailable,
    };
  }

  private async extractTextFromPdf(filePath: string): Promise<string | null> {
    try {
      const pdfBuffer = await fs.readFile(filePath);
      return extractTextFromPdfBuffer(pdfBuffer);
    } catch (error) {
      this.logger.warn(
        `Failed to extract text from PDF at ${filePath}: ${error.message}`,
      );
      return null;
    }
  }

  private checkExpiryFromText(text: string): boolean {
    const now = new Date();

    // Look for expiry date patterns
    const expiryPatterns = [
      /(?:expir(?:es|ed|ation|y)|valid\s+(?:until|thru|through)|end\s+date)[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/gi,
      /(?:expir(?:es|ed|ation|y)|valid\s+(?:until|thru|through)|end\s+date)[:\s]*(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/gi,
      /(?:expir(?:es|ed|ation|y)|valid\s+(?:until|thru|through)|end\s+date)[:\s]*([a-z]+\s+\d{1,2},?\s+\d{4})/gi,
    ];

    for (const pattern of expiryPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const dateStr = match[1];
        const parsedDate = this.parseDate(dateStr);
        if (parsedDate && parsedDate < now) {
          return true;
        }
      }
    }

    return false;
  }

  private parseDate(dateStr: string): Date | null {
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  private async checkCoordinateOverlap(document: Document): Promise<boolean> {
    // Skip overlap check if document has no coordinates
    if (!document.latitude || !document.longitude) {
      return false;
    }

    // Configurable proximity radius in kilometers (default: 0.1 km = 100 meters)
    const proximityRadiusKm = parseFloat(
      this.configService.get<string>('OVERLAP_PROXIMITY_KM') || '0.1',
    );

    // Find all documents with coordinates
    const documentsWithCoords =
      await this.documentsService.findAllWithCoordinates();

    // Check if any other document is within the proximity radius
    for (const otherDoc of documentsWithCoords) {
      if (otherDoc.id === document.id) continue;
      if (!otherDoc.latitude || !otherDoc.longitude) continue;

      const distance = this.calculateDistanceKm(
        document.latitude,
        document.longitude,
        otherDoc.latitude,
        otherDoc.longitude,
      );

      if (distance <= proximityRadiusKm) {
        return true;
      }
    }

    return false;
  }

  private calculateDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private calculateScore(flags: RiskFlag[]): number {
    const rawScore = flags.reduce(
      (total, flag) => total + (FLAG_WEIGHTS[flag] ?? 0),
      0,
    );
    return Math.min(100, Math.max(0, rawScore));
  }
}
