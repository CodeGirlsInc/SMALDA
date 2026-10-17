/**
 * Stellar network normalisation (#1495).
 *
 * `STELLAR_NETWORK` was interpreted as a passphrase in one place and as a
 * network name in another. This maps names to passphrases and back so both
 * stay consistent.
 */
export enum StellarNetwork {
  PUBLIC = "PUBLIC",
  TESTNET = "TESTNET",
  FUTURENET = "FUTURENET",
}

const PASSPHRASES: Record<StellarNetwork, string> = {
  [StellarNetwork.PUBLIC]: "Public Global Stellar Network ; September 2015",
  [StellarNetwork.TESTNET]: "Test SDF Network ; September 2015",
  [StellarNetwork.FUTURENET]: "Test SDF Future Network ; October 2022",
};

/** Resolve a network name to its passphrase. */
export function passphraseFor(network: StellarNetwork): string {
  return PASSPHRASES[network];
}

/** Resolve a passphrase or name back to a `StellarNetwork`, or `null`. */
export function networkFrom(value: string): StellarNetwork | null {
  const upper = value.trim().toUpperCase();
  if (upper in PASSPHRASES) {
    return upper as StellarNetwork;
  }
  const match = (
    Object.entries(PASSPHRASES) as [StellarNetwork, string][]
  ).find(([, passphrase]) => passphrase === value);
  return match ? match[0] : null;
}
