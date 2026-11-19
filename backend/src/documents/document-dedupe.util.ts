import { ConflictException } from '@nestjs/common';

/** #1581: a duplicate file_hash insert is a 409 (possible duplicate claim), not a 500. */
export function rethrowDuplicateHash(err: unknown): never {
  if ((err as { code?: string })?.code === '23505') {
    throw new ConflictException('A document with this file hash has already been registered');
  }
  throw err;
}

/** #1581: remove the file written before a failed insert so nothing is orphaned. */
export async function cleanupOnFailure<T>(work: () => Promise<T>, cleanup: () => Promise<void>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    await cleanup().catch(() => undefined);
    throw err;
  }
}

/** #1582: analysis yields a risk outcome; only anchoring may set VERIFIED. */
export const statusAfterAnalysis = (flagged: boolean) => (flagged ? 'FLAGGED' : 'ANALYZED');

/** #1582: low-risk (ANALYZED) documents can be anchored; flagged ones need review first. */
export const canRequestAnchor = (status: string) => status === 'ANALYZED';
