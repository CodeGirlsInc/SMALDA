import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { DocumentsService } from '../documents/documents.service';
import { VerificationService } from './verification.service';
import { VerificationCacheService } from './verification-cache.service';
import { VerificationStatus } from './entities/verification-record.entity';

// Stricter rate limiting for public endpoint (10 requests per minute)
@Throttle({ default: { ttl: 60000, limit: 10 } })
@Controller('verify')
export class VerificationController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly verificationService: VerificationService,
    private readonly verificationCache: VerificationCacheService,
  ) {}

  @Get(':hash')
  async verifyByHash(@Param('hash') hash: string) {
    // Validate hash format: 64-character hex string (SHA-256)
    if (!hash || !/^[a-fA-F0-9]{64}$/.test(hash)) {
      throw new BadRequestException(
        'Invalid hash format. Expected 64-character hexadecimal SHA-256 hash',
      );
    }

    // Check cache first
    const cached = this.verificationCache.get(hash);
    if (cached !== undefined) {
      return cached;
    }

    // Look up document by file hash
    const document = await this.documentsService.findByFileHash(hash);
    if (!document) {
      const response = {
        verified: false,
        message: 'Document not found',
        verificationStatus: null,
        documentStatus: null,
      };
      this.verificationCache.set(hash, response);
      return response;
    }

    // Get the latest verification record
    const record = await this.verificationService.findLatestByDocument(
      document.id,
    );

    // Only a CONFIRMED record means the document is actually on-chain.
    // PENDING and FAILED records must be reported as unverified with their
    // status so callers can distinguish the two.
    let response;
    if (record?.status === VerificationStatus.CONFIRMED) {
      response = {
        verified: true,
        stellarTxHash: record.stellarTxHash,
        stellarLedger: record.stellarLedger,
        anchoredAt: record.anchoredAt,
        verificationStatus: record.status,
        documentStatus: document.status,
      };
    } else {
      const message =
        record?.status === VerificationStatus.PENDING
          ? 'Verification is pending'
          : record?.status === VerificationStatus.FAILED
            ? 'Verification failed'
            : 'Document has not been verified on Stellar';
      response = {
        verified: false,
        message,
        verificationStatus: record?.status ?? null,
        documentStatus: document.status,
      };
    }

    this.verificationCache.set(hash, response, document.id);
    return response;
  }
}
