import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type StellarNetwork = 'mainnet' | 'testnet' | 'futurenet';

/**
 * Guards against verifying a document hash anchored on one Stellar network
 * against data from a different network. Closes #1344
 */
@Injectable()
export class NetworkMismatchGuard {
  private readonly activeNetwork: StellarNetwork;

  constructor(private readonly config: ConfigService) {
    this.activeNetwork = (
      this.config.get<string>('STELLAR_NETWORK') ?? 'testnet'
    ) as StellarNetwork;
  }

  /**
   * Throws BadRequestException if `anchoredOn` differs from the active network.
   */
  assertNetworkMatch(anchoredOn: StellarNetwork): void {
    if (anchoredOn !== this.activeNetwork) {
      throw new BadRequestException(
        `Network mismatch: hash was anchored on "${anchoredOn}" ` +
        `but the active network is "${this.activeNetwork}".`,
      );
    }
  }
}
