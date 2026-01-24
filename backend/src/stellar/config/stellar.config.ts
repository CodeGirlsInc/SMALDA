export interface StellarConfig {
  testnet: {
    horizonUrl: string;
    networkPassphrase: string;
    friendbotUrl: string;
  };
  mainnet: {
    horizonUrl: string;
    networkPassphrase: string;
  };
  defaultNetwork: 'testnet' | 'mainnet';
  fee: {
    base: number;
    max: number;
  };
  timeouts: {
    transaction: number;
    polling: number;
    confirmation: number;
  };
  retry: {
    attempts: number;
    delay: number;
  };
}
