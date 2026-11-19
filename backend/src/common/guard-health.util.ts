import { HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** #1562: a self-contained JWT guard so ApiKeyAuthGuard needs no injected JwtAuthGuard. */
export const PassportJwtGuard = AuthGuard('jwt');
export const createJwtGuard = () => new PassportJwtGuard();

/** #1563: degraded health must not be reported as 200. */
export function healthHttpStatus(status: 'ok' | 'degraded' | 'down'): number {
  return status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
}

/** #1564: find validation requests for a document, newest first (null when none). */
export async function findLatestByDocument<T>(
  repo: { find(opts: object): Promise<T[]> },
  documentId: string,
): Promise<T | null> {
  const rows = await repo.find({ where: { documentId }, order: { createdAt: 'DESC' }, take: 1 });
  return rows[0] ?? null;
}
