import { Injectable } from '@nestjs/common';
import { TtlCache } from './verification-cache';

const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX_ENTRIES = 1000;

@Injectable()
export class VerificationCacheService {
  private readonly cache = new TtlCache<unknown>(
    CACHE_TTL_MS,
    CACHE_MAX_ENTRIES,
  );

  get(documentHash: string): unknown | undefined {
    return this.cache.get(documentHash);
  }

  set(documentHash: string, result: unknown): void {
    this.cache.set(documentHash, result);
  }

  invalidate(documentHash: string): void {
    this.cache.invalidate(documentHash);
  }

  has(documentHash: string): boolean {
    return this.get(documentHash) !== undefined;
  }

  clear(): void {
    this.cache.clear();
  }
}
