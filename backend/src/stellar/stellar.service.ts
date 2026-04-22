import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Keypair, Networks, Operation, Server, TransactionBuilder } from 'stellar-sdk';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private readonly server: Server;
  private readonly anchorKeypair: Keypair;
  private readonly networkPassphrase: string;
  private readonly accountId: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STELLAR_SECRET_KEY');
    const horizonUrl = this.configService.get<string>('STELLAR_HORIZON_URL') || 'https://horizon-testnet.stellar.org';
    this.networkPassphrase =
      this.configService.get<string>('STELLAR_NETWORK') || Networks.TESTNET;

    if (!secretKey) {
      throw new InternalServerErrorException('Stellar secret key is not configured');
    }

    this.anchorKeypair = Keypair.fromSecret(secretKey);
    this.accountId = this.anchorKeypair.publicKey();
    this.server = new Server(horizonUrl);
  }

  private buildDataKey(hash: string) {
    const sanitized = hash.replace(/[^a-zA-Z0-9]/g, '');
    const payload = sanitized.slice(0, 58);
    return `doc_${payload}`;
  }

  async anchorHash(hash: string): Promise<{ txHash: string; ledger: number }> {
    if (!hash) {
      throw new InternalServerErrorException('Hash is required to anchor a document');
    }

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
      throw new InternalServerErrorException('Unable to anchor document hash on Stellar');
    }
  }

  async verifyHash(hash: string): Promise<boolean> {
    if (!hash) {
      throw new InternalServerErrorException('Hash is required to verify a document');
    }

    try {
      const key = this.buildDataKey(hash);
      await this.server.accountData(this.accountId, key);
      return true;
    } catch (error) {
      if (error?.response?.status === 404) {
        return false;
      }
      this.logger.error('Failed to verify document hash', error);
      throw new InternalServerErrorException('Unable to verify document hash on Stellar');
    }
  }
}
