import { Injectable } from '@nestjs/common';

/**
 * Caches verification results by document hash so identical documents
 * are not re-verified from scratch on every request.
 */
@Injectable()
export class VerificationCacheService {
  private readonly cache = new Map<string, unknown>();

  get(documentHash: string): unknown | undefined {
    return this.cache.get(documentHash);
  }

  set(documentHash: string, result: unknown): void {
    this.cache.set(documentHash, result);
  }

  has(documentHash: string): boolean {
    return this.cache.has(documentHash);
  }

  clear(): void {
    this.cache.clear();
  }
}
