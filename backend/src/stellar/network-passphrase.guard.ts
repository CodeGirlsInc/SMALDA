import { BadRequestException } from '@nestjs/common';

/**
 * Verifies the configured network passphrase matches the intended
 * network before a transaction is submitted, preventing accidental
 * cross-network submissions (testnet vs mainnet).
 */
const NETWORK_PASSPHRASES: Record<string, string> = {
  testnet: 'Test SDF Network ; September 2015',
  mainnet: 'Public Global Stellar Network ; September 2015',
};

export function assertNetworkPassphrase(intendedNetwork: string, configuredPassphrase: string): void {
  const expected = NETWORK_PASSPHRASES[intendedNetwork];
  if (!expected || expected !== configuredPassphrase) {
    throw new BadRequestException(
      `Configured network passphrase does not match intended network "${intendedNetwork}"`,
    );
  }
}
