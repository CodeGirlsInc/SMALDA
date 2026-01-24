import { registerAs } from '@nestjs/config';
import { StellarConfig } from './stellar.config';

export default registerAs('stellar', (): StellarConfig => ({
  testnet: {
    horizonUrl: process.env.STELLAR_TESTNET_HORIZON_URL || 'https://horizon-testnet.stellar.org',
    networkPassphrase: process.env.STELLAR_TESTNET_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
    friendbotUrl: process.env.STELLAR_TESTNET_FRIENDBOT_URL || 'https://friendbot.stellar.org',
  },
  mainnet: {
    horizonUrl: process.env.STELLAR_MAINNET_HORIZON_URL || 'https://horizon.stellar.org',
    networkPassphrase: process.env.STELLAR_MAINNET_NETWORK_PASSPHRASE || 'Public Global Stellar Network ; September 2015',
  },
  defaultNetwork: (process.env.STELLAR_DEFAULT_NETWORK as 'testnet' | 'mainnet') || 'testnet',
  fee: {
    base: parseInt(process.env.STELLAR_BASE_FEE || '100'),
    max: parseInt(process.env.STELLAR_MAX_FEE || '1000'),
  },
  timeouts: {
    transaction: parseInt(process.env.STELLAR_TRANSACTION_TIMEOUT || '30000'),
    polling: parseInt(process.env.STELLAR_POLLING_TIMEOUT || '60000'),
    confirmation: parseInt(process.env.STELLAR_CONFIRMATION_TIMEOUT || '120000'),
  },
  retry: {
    attempts: parseInt(process.env.STELLAR_RETRY_ATTEMPTS || '3'),
    delay: parseInt(process.env.STELLAR_RETRY_DELAY || '1000'),
  },
}));
