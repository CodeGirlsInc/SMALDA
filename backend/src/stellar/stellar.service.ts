import {
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Keypair,
  Horizon,
  Networks,
  Operation,
  TransactionBuilder,
} from 'stellar-sdk';
import { correlationIdStorage } from '../common/correlation/correlation-id.storage';
import {
  classifyStellarError,
  isRetryableStellarError,
  isPermanentStellarError,
  withStellarRetry,
} from './stellar-retry.util';
import { VerifierClient } from './verifier-client.service';

const BREAKER_THRESHOLD = 3;
const BREAKER_RESET_MS = 60_000;
const DEFAULT_MAX_FEE = 10_000;
const DEFAULT_MAX_ATTEMPTS = 3;

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private readonly server: Horizon.Server;
  private readonly anchorKeypair: Keypair;
  private readonly networkPassphrase: string;
  private readonly accountId: string;
  private readonly maxFee: number;
  private readonly maxAttempts: number;
  private failureCount = 0;
  private circuitOpenUntil: Date | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly verifierClient?: VerifierClient,
  ) {
    const secretKey = this.configService.get<string>('STELLAR_SECRET_KEY');
    const horizonUrl =
      this.configService.get<string>('STELLAR_HORIZON_URL') ||
      'https://horizon-testnet.stellar.org';
    this.networkPassphrase =
      this.configService.get<string>('STELLAR_NETWORK') || Networks.TESTNET;
    this.maxFee =
      Number(this.configService.get<number>('STELLAR_MAX_FEE', DEFAULT_MAX_FEE)) ||
      DEFAULT_MAX_FEE;
    this.maxAttempts =
      Number(
        this.configService.get<number>('STELLAR_MAX_RETRIES', DEFAULT_MAX_ATTEMPTS),
      ) || DEFAULT_MAX_ATTEMPTS;

    if (!secretKey) {
      throw new InternalServerErrorException(
        'Stellar secret key is not configured',
      );
    }

    this.anchorKeypair = Keypair.fromSecret(secretKey);
    this.accountId = this.anchorKeypair.publicKey();
    this.server = new Horizon.Server(horizonUrl);
  }

  private buildDataKey(hash: string): string {
    const sanitized = hash.replace(/[^a-zA-Z0-9]/g, '');
    const payload = sanitized.slice(0, 58);
    return `doc_${payload}`;
  }

  private buildRevocationKey(hash: string): string {
    const sanitized = hash.replace(/[^a-zA-Z0-9]/g, '');
    return `revoked_${sanitized.slice(0, 56)}`;
  }

  private get verifierEnabled(): boolean {
    return Boolean(this.verifierClient?.isConfigured);
  }

  private requestId(): string | undefined {
    return correlationIdStorage.getStore();
  }

  private checkCircuit(): void {
    if (this.circuitOpenUntil && this.circuitOpenUntil > new Date()) {
      throw new ServiceUnavailableException(
        'Stellar network circuit breaker is open',
      );
    }
  }

  /**
   * Use Horizon's current base fee, capped by STELLAR_MAX_FEE. Pinning the
   * fee to 100 stroops made every anchor fail during surge pricing.
   */
  private async resolveFee(): Promise<string> {
    let baseFee = 100;
    const fetchBaseFee = (this.server as any).fetchBaseFee;
    if (typeof fetchBaseFee === 'function') {
      const fetched = await withStellarRetry(
        () => Promise.resolve(fetchBaseFee.call(this.server)),
        this.maxAttempts,
        200,
      );
      baseFee = Number(fetched) || baseFee;
    }

    if (!Number.isFinite(baseFee) || baseFee <= 0) baseFee = 100;
    return String(Math.max(1, Math.min(Math.floor(baseFee), this.maxFee)));
  }

  private recordFailure(error: unknown): void {
    // Permanent transaction failures (e.g. op_underfunded) are caller/data
    // problems. They must not exhaust the circuit breaker like outages do.
    if (isPermanentStellarError(error)) {
      this.logger.warn(
        `Permanent Stellar failure (${classifyStellarError(error)}): ${(error as any)?.message}`,
      );
      return;
    }

    this.failureCount += 1;
    if (this.failureCount >= BREAKER_THRESHOLD) {
      this.circuitOpenUntil = new Date(Date.now() + BREAKER_RESET_MS);
      this.logger.warn(
        `Stellar circuit breaker opened after ${this.failureCount} consecutive failures`,
      );
    }
  }

  private recordSuccess(): void {
    if (this.circuitOpenUntil && this.circuitOpenUntil <= new Date()) {
      this.circuitOpenUntil = null;
    }
    this.failureCount = 0;
  }

  private async submitManageData(
    name: string,
    value: string,
  ): Promise<{ txHash: string; ledger: number }> {
    const account = await withStellarRetry(
      () => this.server.loadAccount(this.accountId),
      this.maxAttempts,
    );
    const fee = await this.resolveFee();

    const transaction = new TransactionBuilder(account, {
      fee,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(Operation.manageData({ name, value }))
      .setTimeout(30)
      .build();

    transaction.sign(this.anchorKeypair);
    const result = await withStellarRetry(
      () => this.server.submitTransaction(transaction),
      this.maxAttempts,
    );
    return { txHash: result.hash, ledger: result.ledger };
  }

  async anchorHash(
    hash: string,
    documentId?: string,
    submitter?: string,
  ): Promise<{ txHash: string; ledger: number }> {
    if (!hash) {
      throw new InternalServerErrorException(
        'Hash is required to anchor a document',
      );
    }

    this.checkCircuit();

    if (this.verifierEnabled) {
      try {
        const result = await this.verifierClient!.submit(
          {
            documentHash: hash,
            documentId: documentId || hash,
            submitter: submitter || this.accountId,
          },
          this.requestId(),
        );
        if (!result.success) {
          throw new Error('Verifier did not anchor the document hash');
        }
        this.recordSuccess();
        return { txHash: result.transaction_id || '', ledger: 0 };
      } catch (error) {
        this.recordFailure(error);
        this.logger.error('Failed to anchor document hash via verifier', error);
        throw new InternalServerErrorException(
          'Unable to anchor document hash on Stellar',
        );
      }
    }

    try {
      const result = await this.submitManageData(this.buildDataKey(hash), hash);
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      this.logger.error('Failed to anchor document hash', error);
      throw new InternalServerErrorException(
        'Unable to anchor document hash on Stellar',
      );
    }
  }

  async verifyHash(hash: string): Promise<boolean> {
    if (!hash) {
      throw new InternalServerErrorException(
        'Hash is required to verify a document',
      );
    }

    this.checkCircuit();

    if (this.verifierEnabled) {
      try {
        const result = await this.verifierClient!.verify(hash, null, this.requestId());
        this.recordSuccess();
        return result.verified === true && result.revoked !== true;
      } catch (error) {
        this.recordFailure(error);
        this.logger.error('Failed to verify document hash via verifier', error);
        throw new InternalServerErrorException(
          'Unable to verify document hash on Stellar',
        );
      }
    }

    try {
      const account = await withStellarRetry(
        () => this.server.loadAccount(this.accountId),
        this.maxAttempts,
      );
      const exists = this.buildDataKey(hash) in account.data_attr;
      this.recordSuccess();
      return exists;
    } catch (error) {
      if (error?.response?.status === 404) {
        this.recordSuccess();
        return false;
      }
      this.recordFailure(error);
      this.logger.error('Failed to verify document hash', error);
      throw new InternalServerErrorException(
        'Unable to verify document hash on Stellar',
      );
    }
  }

  /**
   * Propagate a revocation to the chain (and the verifier cache, when the
   * verifier is configured). The verifier detects revocations by the presence
   * of a `revoked_<hash>` ManageData entry, matching its own key scheme.
   */
  async revokeHash(
    hash: string,
    reason = 'Document revoked',
    revokedBy?: string,
  ): Promise<{ txHash: string; ledger: number }> {
    if (!hash) {
      throw new InternalServerErrorException(
        'Hash is required to revoke a document',
      );
    }

    this.checkCircuit();

    if (this.verifierEnabled) {
      try {
        const result = await this.verifierClient!.revoke(
          {
            documentHash: hash,
            reason,
            revokedBy: revokedBy || this.accountId,
          },
          this.requestId(),
        );
        this.recordSuccess();
        return { txHash: result.transaction_id, ledger: 0 };
      } catch (error) {
        this.recordFailure(error);
        this.logger.error('Failed to revoke document hash via verifier', error);
        throw new InternalServerErrorException(
          'Unable to revoke document hash on Stellar',
        );
      }
    }

    try {
      const value = JSON.stringify({
        revokedAt: new Date().toISOString(),
        reason: reason.slice(0, 24),
      }).slice(0, 64);
      const result = await this.submitManageData(
        this.buildRevocationKey(hash),
        value,
      );
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      this.logger.error('Failed to revoke document hash', error);
      throw new InternalServerErrorException(
        'Unable to revoke document hash on Stellar',
      );
    }
  }

  /** Exposed for diagnostics/tests: classify a Horizon error. */
  classifyError(error: unknown) {
    return classifyStellarError(error);
  }

  /** Exposed for diagnostics/tests: whether a Horizon error is retryable. */
  isRetryable(error: unknown): boolean {
    return isRetryableStellarError(error);
  }
}
