import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src', import.meta.url));
const removed = [
  'auth/account-lockout.guard.ts',
  'auth/brute-force.guard.ts',
  'auth/brute-force.guard.spec.ts',
  'auth/refresh-token-reuse.guard.ts',
  'auth/jwt-expiry.config.ts',
  'common/pagination.ts',
  'common/stellar-network.ts',
  'common/correlation-id.middleware.ts',
  'dispute/dispute-classification-confidence.ts',
  'dispute/dto/reassign-dispute.dto.ts',
  'disputes/dispute-actions.constants.ts',
  'documents/idempotency.interceptor.ts',
  'documents/idempotency.interceptor.spec.ts',
  'documents/idempotency-key.util.ts',
  'documents/malware-scan.guard.ts',
  'documents/documents-gateway-auth.guard.ts',
  'documents/pipes/file-size-validation.pipe.ts',
  'documents/pipes/mime-type-validation.pipe.ts',
  'femaleotaku.spec.ts',
  'prismn.spec.ts',
  'health/health-status.ts',
  'network/network-mismatch.guard.ts',
  'network/network.controller.ts',
  'queue/dead-letter-queue.service.ts',
  'queue/queue-duration-metric.util.ts',
  'stellar/network-passphrase.guard.ts',
  'stellar/stellar-retry.util.ts',
  'transfer/ownership-transfer-event.service.ts',
  'users/user-soft-delete.util.ts',
  'verification/batch-verification-result.ts',
  'verification/verification-idempotency.interceptor.ts',
];

const found = removed.filter((file) => existsSync(join(root, file)));

if (found.length > 0) {
  console.error('Removed helper paths must stay deleted:');
  for (const file of found) console.error(`  src/${file}`);
  process.exit(1);
}

console.log(`Dead helper check passed (${removed.length} paths absent).`);
