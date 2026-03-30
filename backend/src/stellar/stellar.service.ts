import { Injectable, InternalServerErrorException, BadRequestException, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Horizon, Keypair, Networks, Operation, TransactionBuilder } from 'stellar-sdk';
import type { Redis } from 'ioredis';

export const STELLAR_REDIS = 'STELLAR_REDIS';

const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private readonly server: Horizon.Server;
  private readonly anchorKeypair: Keypair;
  private readonly networkPassphrase: string;
  private readonly accountId: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(STELLAR_REDIS) private readonly redis: Redis,
  ) {
    const secretKey = this.configService.get<string>('STELLAR_SECRET_KEY');
    const horizonUrl = this.configService.get<string>('STELLAR_HORIZON_URL');
    this.networkPassphrase = this.configService.get<string>('STELLAR_NETWORK');

    if (!secretKey) {
      throw new InternalServerErrorException('Stellar secret key is not configured');
    }

    if (!horizonUrl) {
      throw new InternalServerErrorException('Stellar horizon URL is not configured');
    }

    if (!this.networkPassphrase) {
      throw new InternalServerErrorException('Stellar network passphrase is not configured');
    }

    this.anchorKeypair = Keypair.fromSecret(secretKey);
    this.accountId = this.anchorKeypair.publicKey();
    this.server = new Horizon.Server(horizonUrl);
  }

  /**
   * Validates that the input is a well-formed SHA-256 hex digest.
   * Throws BadRequestException (400) — not 500 — because malformed input
   * is a caller error, not a server fault.
   */
  private validateHash(hash: string): void {
    if (!hash || !SHA256_HEX_REGEX.test(hash)) {
      throw new BadRequestException(
        'Invalid hash: expected a 64-character lowercase hex SHA-256 digest.',
      );
    }
  }

  private buildDataKey(hash: string): string {
    const sanitized = hash.replace(/[^a-zA-Z0-9]/g, '');
    const payload = sanitized.slice(0, 58);
    return `doc_${payload}`;
  }

  async anchorHash(hash: string): Promise<{ txHash: string; ledger: number }> {
    this.validateHash(hash); // replaces the loose `if (!hash)` guard

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
      return { txHash: result.hash, ledger: result.ledger };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Failed to anchor document hash', error);
      throw new InternalServerErrorException('Unable to anchor document hash on Stellar');
    }
  }

  async verifyHash(hash: string): Promise<boolean> {
    this.validateHash(hash); // replaces the loose `if (!hash)` guard

    const cacheKey = `stellar:verify:${hash}`;
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) return cached === 'true';

    try {
      const key = this.buildDataKey(hash);
      const account = await this.server.accounts().accountId(this.accountId).call();
      if (!account.data_attr || !(key in account.data_attr)) {
        const err: any = new Error('Not found');
        err.response = { status: 404 };
        throw err;
      }
      await this.redis.set(cacheKey, 'true');
      return true;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error?.response?.status === 404) {
        await this.redis.set(cacheKey, 'false', 'EX', 60);
        return false;
      }
      this.logger.error('Failed to verify document hash', error);
      throw new InternalServerErrorException('Unable to verify document hash on Stellar');
    }
  }
}