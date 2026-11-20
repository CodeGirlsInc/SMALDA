import { Injectable } from '@nestjs/common';
import { TtlCache } from './verification-cache';

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 1000;

/**
 * Caches verification results by document hash so identical documents are not
 * re-verified from scratch on every request. Backed by a bounded TTL cache:
 * entries expire, the cache cannot grow without limit, and entries can be
 * invalidated when a document's verification state changes.
 */
@Injectable()
export class VerificationCacheService {
  private readonly cache = new TtlCache<unknown>(CACHE_TTL_MS, MAX_CACHE_ENTRIES);
  private readonly hashesByDocument = new TtlCache<Set<string>>(
    CACHE_TTL_MS,
    MAX_CACHE_ENTRIES,
  );

  get(documentHash: string): unknown | undefined {
    return this.cache.get(documentHash);
  }

  set(documentHash: string, result: unknown, documentId?: string): void {
    this.cache.set(documentHash, result);
    if (documentId) {
      const hashes =
        this.hashesByDocument.get(documentId) ?? new Set<string>();
      hashes.add(documentHash);
      this.hashesByDocument.set(documentId, hashes);
    }
  }

  has(documentHash: string): boolean {
    return this.get(documentHash) !== undefined;
  }

  invalidate(documentHash: string): void {
    this.cache.invalidate(documentHash);
  }

  invalidateByDocument(documentId: string): void {
    const hashes = this.hashesByDocument.get(documentId);
    if (!hashes) return;
    for (const documentHash of hashes) {
      this.cache.invalidate(documentHash);
    }
    this.hashesByDocument.invalidate(documentId);
  }

  clear(): void {
    this.cache.clear();
    this.hashesByDocument.clear();
  }
}
