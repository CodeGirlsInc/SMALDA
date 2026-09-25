import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type StellarNetwork = 'mainnet' | 'testnet' | 'futurenet';

/**
 * Exposes the currently active Stellar network so operators can confirm
 * the running environment without inspecting config files.
 * Closes #1343
 */
@Controller('network')
export class NetworkController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  getNetwork(): { network: StellarNetwork; horizonUrl: string } {
    const network = (this.config.get<string>('STELLAR_NETWORK') ?? 'testnet') as StellarNetwork;
    const horizonUrl = this.config.get<string>('STELLAR_HORIZON_URL') ?? '';

    return { network, horizonUrl };
  }
}
