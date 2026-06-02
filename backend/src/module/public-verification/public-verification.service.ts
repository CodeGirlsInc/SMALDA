import { Injectable } from '@nestjs/common';

import { DocumentsService } from '../../documents/documents.service';
import { StellarService } from '../../stellar/stellar.service';
import { VerificationService } from '../../verification/verification.service';

export interface PublicVerificationResult {
  verified: boolean;
  txHash: string | null;
  ledger: number | null;
  anchoredAt: Date | null;
}

@Injectable()
export class PublicVerificationService {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly verificationService: VerificationService,
    private readonly stellarService: StellarService,
  ) {}

  async verifyHash(hash: string): Promise<PublicVerificationResult> {
    const verifiedOnStellar = await this.stellarService.verifyHash(hash);

    if (!verifiedOnStellar) {
      return this.createEmptyResponse();
    }

    const document = await this.documentsService.findByFileHash(hash);
    if (!document) {
      return this.createEmptyResponse(true);
    }

    const latestVerification =
      await this.verificationService.findLatestByDocument(document.id);

    if (!latestVerification) {
      return this.createEmptyResponse(true);
    }

    return {
      verified: true,
      txHash: latestVerification.stellarTxHash,
      ledger: latestVerification.stellarLedger,
      anchoredAt: latestVerification.anchoredAt ?? null,
    };
  }

  private createEmptyResponse(verified = false): PublicVerificationResult {
    return {
      verified,
      txHash: null,
      ledger: null,
      anchoredAt: null,
    };
  }
}
