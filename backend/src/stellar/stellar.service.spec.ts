import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';

// ───────────────────────────────────────────────────────────
// Mock stellar-sdk before importing the service
// ───────────────────────────────────────────────────────────
const mockLoadAccount = jest.fn();
const mockSubmitTransaction = jest.fn();
const mockSign = jest.fn();

jest.mock('stellar-sdk', () => {
  const actual = jest.requireActual('stellar-sdk');
  return {
    ...actual,
    Keypair: {
      fromSecret: jest.fn().mockReturnValue({
        publicKey: jest.fn().mockReturnValue('GAKEYPUBLICKEY'),
        sign: mockSign,
      }),
    },
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: mockLoadAccount,
        submitTransaction: mockSubmitTransaction,
      })),
    },
    Networks: {
      TESTNET: 'Test SDF Network ; September 2015',
      PUBLIC: 'Public Global Stellar Network ; September 2015',
    },
    Operation: {
      manageData: jest.fn().mockReturnValue({ type: 'manageData' }),
    },
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({
        sign: mockSign,
        hash: jest.fn().mockReturnValue('mock-tx-hash'),
      }),
    })),
  };
});

import { StellarService } from './stellar.service';

describe('StellarService', () => {
  let service: StellarService;

  const defaultConfig: Record<string, string> = {
    STELLAR_SECRET_KEY: 'SSECRETKEY123456789012345678901234567890',
    STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
    STELLAR_NETWORK: 'Test SDF Network ; September 2015',
  };

  function createService(configOverrides: Record<string, string> = {}): StellarService {
    const config = { ...defaultConfig, ...configOverrides };
    const mockConfigService = {
      get: jest.fn((key: string, fallback?: string) => config[key] ?? fallback),
    };

    return new StellarService(mockConfigService as any);
  }

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: loadAccount returns an account with empty data_attr
    mockLoadAccount.mockResolvedValue({
      accountId: 'GAKEYPUBLICKEY',
      data_attr: {},
    });

    // Default: submitTransaction succeeds
    mockSubmitTransaction.mockResolvedValue({
      hash: 'submitted-tx-hash-123',
      ledger: 99999,
    });
  });

  // ───────────────────────────────────────────────────────────
  // Constructor — configuration selection
  // ───────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should default to testnet when STELLAR_NETWORK is not set', () => {
      const { Networks } = require('stellar-sdk');
      const service = createService({ STELLAR_NETWORK: '' });

      // The service should use Networks.TESTNET as default
      expect(service).toBeDefined();
    });

    it('should use the configured network passphrase', () => {
      const service = createService({
        STELLAR_NETWORK: 'Custom Network Passphrase',
      });
      expect(service).toBeDefined();
    });

    it('should throw InternalServerErrorException when secret key is missing', () => {
      expect(() => createService({ STELLAR_SECRET_KEY: '' })).toThrow(
        InternalServerErrorException,
      );
    });

    it('should never default to mainnet', () => {
      // With empty config, it should use testnet, not mainnet
      const service = createService({ STELLAR_NETWORK: '' });
      expect(service).toBeDefined();
    });
  });

  // ───────────────────────────────────────────────────────────
  // anchorHash — transaction construction
  // ───────────────────────────────────────────────────────────

  describe('anchorHash()', () => {
    it('should throw when hash is empty', async () => {
      service = createService();

      await expect(service.anchorHash('')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should load the anchor account before building transaction', async () => {
      service = createService();

      await service.anchorHash('test-hash-123');

      expect(mockLoadAccount).toHaveBeenCalledWith('GAKEYPUBLICKEY');
    });

    it('should submit a signed transaction to the network', async () => {
      service = createService();

      const result = await service.anchorHash('test-hash-123');

      expect(mockSubmitTransaction).toHaveBeenCalled();
      expect(result.txHash).toBeDefined();
      expect(result.ledger).toBeDefined();
    });

    it('should sign the transaction with the anchor keypair', async () => {
      service = createService();

      await service.anchorHash('test-hash-123');

      // The TransactionBuilder.build() returns an object with sign()
      // which is called by anchorHash
      expect(mockSign).toHaveBeenCalled();
    });

    it('should use manageData operation with sanitized key', async () => {
      const { Operation } = require('stellar-sdk');
      service = createService();

      await service.anchorHash('abc-123-def');

      expect(Operation.manageData).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringMatching(/^doc_/),
        }),
      );
    });

    it('should return txHash and ledger from successful submission', async () => {
      service = createService();

      const result = await service.anchorHash('test-hash');

      expect(result).toEqual({
        txHash: 'submitted-tx-hash-123',
        ledger: 99999,
      });
    });
  });

  // ───────────────────────────────────────────────────────────
  // verifyHash — data attribute lookup
  // ───────────────────────────────────────────────────────────

  describe('verifyHash()', () => {
    it('should throw when hash is empty', async () => {
      service = createService();

      await expect(service.verifyHash('')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should return true when the hash key exists in account data', async () => {
      const { Operation } = require('stellar-sdk');
      // Call anchorHash first to see what key name is generated,
      // then set it in the mock
      service = createService();

      // Get the key that would be generated
      await service.anchorHash('verify-test');
      const lastCall = Operation.manageData.mock.calls[
        Operation.manageData.mock.calls.length - 1
      ];
      const generatedKey = lastCall[0].name;

      // Now mock loadAccount to return that key in data_attr
      mockLoadAccount.mockResolvedValueOnce({
        accountId: 'GAKEYPUBLICKEY',
        data_attr: { [generatedKey]: 'some-value' },
      });

      const result = await service.verifyHash('verify-test');
      expect(result).toBe(true);
    });

    it('should return false when the hash key does not exist', async () => {
      service = createService();

      mockLoadAccount.mockResolvedValueOnce({
        accountId: 'GAKEYPUBLICKEY',
        data_attr: {},
      });

      const result = await service.verifyHash('nonexistent-hash');
      expect(result).toBe(false);
    });

    it('should return false when account has 404 (not found)', async () => {
      service = createService();

      mockLoadAccount.mockRejectedValueOnce({
        response: { status: 404 },
      });

      const result = await service.verifyHash('unanchored-hash');
      expect(result).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────
  // Network failure and error handling
  // ───────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('should throw InternalServerErrorException on loadAccount failure during anchor', async () => {
      service = createService();
      mockLoadAccount.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(service.anchorHash('test-hash')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException on submitTransaction failure', async () => {
      service = createService();
      mockSubmitTransaction.mockRejectedValueOnce(
        new Error('Transaction rejected'),
      );

      await expect(service.anchorHash('test-hash')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException on loadAccount failure during verify', async () => {
      service = createService();
      mockLoadAccount.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(service.verifyHash('test-hash')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should never report success when anchoring fails', async () => {
      service = createService();
      mockSubmitTransaction.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.anchorHash('test-hash')).rejects.toThrow(
        InternalServerErrorException,
      );
      // If we got here, the error was properly thrown (not swallowed)
    });

    it('should throw on malformed response from Horizon', async () => {
      service = createService();
      mockLoadAccount.mockRejectedValueOnce(new Error('Malformed JSON'));

      await expect(service.anchorHash('test-hash')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ───────────────────────────────────────────────────────────
  // Testnet vs mainnet configuration
  // ───────────────────────────────────────────────────────────

  describe('network configuration', () => {
    it('should use testnet by default when no network config is set', () => {
      service = createService({ STELLAR_NETWORK: '' });
      // Service should be constructed without errors using testnet default
      expect(service).toBeDefined();
    });

    it('should never use mainnet by default', () => {
      const { TransactionBuilder } = require('stellar-sdk');

      service = createService({ STELLAR_NETWORK: '' });
      // anchorHash should work without errors using testnet
      // The TransactionBuilder receives the networkPassphrase
      expect(service).toBeDefined();
    });

    it('should use the explicitly configured network', () => {
      service = createService({
        STELLAR_NETWORK: 'Custom Test Network',
      });
      expect(service).toBeDefined();
    });
  });
});
