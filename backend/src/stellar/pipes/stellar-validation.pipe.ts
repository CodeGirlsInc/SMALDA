import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { validate, validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { NetworkType } from '../entities/stellar-transaction.entity';

@Injectable()
export class StellarValidationPipe implements PipeTransform<any> {
  transform(value: any, metadata: ArgumentMetadata) {
    if (!value) {
      throw new BadRequestException('No data provided');
    }

    // Validate Stellar public key format
    if (value.publicKey || value.sourcePublicKey) {
      const publicKey = value.publicKey || value.sourcePublicKey;
      if (!this.isValidStellarPublicKey(publicKey)) {
        throw new BadRequestException('Invalid Stellar public key format');
      }
    }

    // Validate Stellar secret key format
    if (value.secretKey || value.sourceSecretKey) {
      const secretKey = value.secretKey || value.sourceSecretKey;
      if (!this.isValidStellarSecretKey(secretKey)) {
        throw new BadRequestException('Invalid Stellar secret key format');
      }
    }

    // Validate document hash format (assuming SHA-256)
    if (value.documentHash) {
      if (!this.isValidHash(value.documentHash)) {
        throw new BadRequestException('Invalid document hash format. Expected 64-character hexadecimal string');
      }
    }

    // Validate document hashes array
    if (value.documentHashes && Array.isArray(value.documentHashes)) {
      for (const hash of value.documentHashes) {
        if (!this.isValidHash(hash)) {
          throw new BadRequestException('Invalid document hash format in array. Expected 64-character hexadecimal string');
        }
      }
    }

    // Validate transaction hash format
    if (value.transactionHash) {
      if (!this.isValidTransactionHash(value.transactionHash)) {
        throw new BadRequestException('Invalid transaction hash format');
      }
    }

    // Validate network type
    if (value.network && !Object.values(NetworkType).includes(value.network)) {
      throw new BadRequestException(`Invalid network type. Must be one of: ${Object.values(NetworkType).join(', ')}`);
    }

    return value;
  }

  private isValidStellarPublicKey(publicKey: string): boolean {
    // Stellar public keys start with 'G' and are 56 characters long
    return /^[G][A-Z0-9]{55}$/.test(publicKey);
  }

  private isValidStellarSecretKey(secretKey: string): boolean {
    // Stellar secret keys start with 'S' and are 56 characters long
    return /^[S][A-Z0-9]{55}$/.test(secretKey);
  }

  private isValidHash(hash: string): boolean {
    // SHA-256 hash is 64 characters hexadecimal
    return /^[a-fA-F0-9]{64}$/.test(hash);
  }

  private isValidTransactionHash(hash: string): boolean {
    // Stellar transaction hashes are 64 characters hexadecimal
    return /^[a-fA-F0-9]{64}$/.test(hash);
  }
}

@Injectable()
export class StellarSanitizationPipe implements PipeTransform<any> {
  transform(value: any) {
    if (!value || typeof value !== 'object') {
      return value;
    }

    const sanitized = { ...value };

    // Remove any potential XSS or injection attempts
    const keys = Object.keys(sanitized);
    keys.forEach(key => {
      if (typeof sanitized[key] === 'string') {
        sanitized[key] = sanitized[key].trim();
        
        // Remove any script tags or potentially dangerous content
        sanitized[key] = sanitized[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        sanitized[key] = sanitized[key].replace(/javascript:/gi, '');
        sanitized[key] = sanitized[key].replace(/on\w+\s*=/gi, '');
      }
    });

    return sanitized;
  }
}
