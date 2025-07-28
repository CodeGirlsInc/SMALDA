import { Injectable } from '@nestjs/common';
import { LandMetadataDto } from './dto/LandMetadataDto';
import { RedFlagResult } from './dto/RedFlagResult';

@Injectable()
export class RedFlagCheckerService {
  private knownLandClaims: Map<string, LandMetadataDto> = new Map();

  checkLand(land: LandMetadataDto): RedFlagResult {
    const flags: string[] = [];

    if (land.owner.toLowerCase() !== 'starknet') {
      flags.push('Owner is not Starknet');
    }

    const existing = this.knownLandClaims.get(land.landId);
    if (existing) {
      flags.push('Duplicate land ID claim');
    } else {
      this.knownLandClaims.set(land.landId, land);
    }

    const now = new Date();
    const expiredDocs = land.documents.filter(
      (doc) => new Date(doc.expiresAt) < now,
    );
    if (expiredDocs.length > 0) {
      flags.push('One or more documents are expired');
    }

    return {
      landId: land.landId,
      flags,
    };
  }
}
