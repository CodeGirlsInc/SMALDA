import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Keypair,
  Horizon,
  Networks,
  Operation,
  TransactionBuilder,
} from 'stellar-sdk';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private readonly server: Horizon.Server;
  private readonly anchorKeypair: Keypair;
  private readonly networkPassphrase: string;
  private readonly accountId: string;
  private readonly SHA256_HASH_REGEX = /^[a-f0-9]{64}$/i;

  constructor(
    private readonly configService: ConfigService,
    @Inject(CacheService) private readonly cacheService: CacheService,
  ) {
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

  private validateHash(hash: string): void {
    if (!this.SHA256_HASH_REGEX.test(hash)) {
      throw new BadRequestException(
        'Invalid SHA-256 hash format. Must be a 64-character hexadecimal string',
      );
    }
  }

  private buildDataKey(hash: string) {
    this.validateHash(hash);
    const payload = hash.slice(0, 58);
    return `doc_${payload}`;
  }

  async anchorHash(hash: string): Promise<{ txHash: string; ledger: number }> {
    this.validateHash(hash);

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
      this.logger.error('Failed to anchor document hash', error);
      throw new InternalServerErrorException(
        'Unable to anchor document hash on Stellar',
      );
    }
  }

  async verifyHash(hash: string): Promise<boolean> {
    this.validateHash(hash);

    const cacheKey = `stellar_verify_${hash}`;
    const cached = await this.cacheService.get<boolean>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const key = this.buildDataKey(hash);
      const account = await this.server.loadAccount(this.accountId);
      const result = key in account.data_attr;
      await this.cacheService.set(cacheKey, result, 600);
      return result;
    } catch (error) {
      if (error?.response?.status === 404) {
        await this.cacheService.set(cacheKey, false, 600);
        return false;
      }
      this.logger.error('Failed to verify document hash', error);
      throw new InternalServerErrorException(
        'Unable to verify document hash on Stellar',
      );
    }
  }
}
