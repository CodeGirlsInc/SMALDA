import {
  Injectable,
  InternalServerErrorException,
  Logger,
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

const BREAKER_THRESHOLD = 3;
const BREAKER_RESET_MS = 60_000;

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private readonly server: Horizon.Server;
  private readonly anchorKeypair: Keypair;
  private readonly networkPassphrase: string;
  private readonly accountId: string;
  private failureCount = 0;
  private circuitOpenUntil: Date | null = null;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STELLAR_SECRET_KEY');
    const horizonUrl =
      this.configService.get<string>('STELLAR_HORIZON_URL') ||
      'https://horizon-testnet.stellar.org';
    this.networkPassphrase =
      this.configService.get<string>('STELLAR_NETWORK') || Networks.TESTNET;

    if (!secretKey) {
      throw new InternalServerErrorException(
        'Stellar secret key is not configured',
      );
    }

    this.anchorKeypair = Keypair.fromSecret(secretKey);
    this.accountId = this.anchorKeypair.publicKey();
    this.server = new Horizon.Server(horizonUrl);
  }

  private buildDataKey(hash: string) {
    const sanitized = hash.replace(/[^a-zA-Z0-9]/g, '');
    const payload = sanitized.slice(0, 58);
    return `doc_${payload}`;
  }

  private checkCircuit(): void {
    if (this.circuitOpenUntil && this.circuitOpenUntil > new Date()) {
      throw new ServiceUnavailableException(
        'Stellar network circuit breaker is open',
      );
    }
  }

  private recordFailure(): void {
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

  async anchorHash(hash: string): Promise<{ txHash: string; ledger: number }> {
    if (!hash) {
      throw new InternalServerErrorException(
        'Hash is required to anchor a document',
      );
    }

    this.checkCircuit();

    try {
      const account = await this.server.loadAccount(this.accountId);
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          Operation.manageData({
            name: this.buildDataKey(hash),
            value: hash,
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(this.anchorKeypair);
      const result = await this.server.submitTransaction(transaction);
      this.recordSuccess();
      return { txHash: result.hash, ledger: result.ledger };
    } catch (error) {
      this.recordFailure();
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

    try {
      const key = this.buildDataKey(hash);
      const account = await this.server.loadAccount(this.accountId);
      const exists = key in account.data_attr;
      this.recordSuccess();
      return exists;
    } catch (error) {
      if (error?.response?.status === 404) {
        this.recordSuccess();
        return false;
      }
      this.recordFailure();
      this.logger.error('Failed to verify document hash', error);
      throw new InternalServerErrorException(
        'Unable to verify document hash on Stellar',
      );
    }
  }
}
