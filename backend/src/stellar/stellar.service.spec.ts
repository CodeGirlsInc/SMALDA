const mockSign = jest.fn();
const mockBuild = jest.fn().mockReturnValue({ sign: mockSign });
const mockSubmitTransaction = jest.fn();
const mockLoadAccount = jest.fn();
const mockAccountsCall = jest.fn();
const mockAccountId = jest.fn().mockReturnValue({ call: mockAccountsCall });

jest.mock('stellar-sdk', () => ({
  Keypair: {
    fromSecret: jest.fn().mockReturnValue({
      publicKey: jest.fn().mockReturnValue('MOCK_ACCOUNT_ID'),
    }),
  },
  Networks: { TESTNET: 'Test SDF Network ; September 2015' },
  Horizon: {
    Server: jest.fn().mockImplementation(() => ({
      loadAccount: mockLoadAccount,
      submitTransaction: mockSubmitTransaction,
      accounts: jest.fn().mockReturnValue({ accountId: mockAccountId }),
    })),
  },
  TransactionBuilder: jest.fn().mockImplementation(() => ({
    addOperation: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: mockBuild,
  })),
  Operation: { manageData: jest.fn().mockReturnValue({}) },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { StellarService, STELLAR_REDIS } from './stellar.service';

describe('StellarService', () => {
  let service: StellarService;
  const mockRedis = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue('OK') };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STELLAR_SECRET_KEY') return 'SCZANGBA5BNUF6LHFL2CDNMFGUIO2IIJIWZ6NQWQDL26DGS7YN6MMCM';
              if (key === 'STELLAR_HORIZON_URL') return 'https://horizon-testnet.stellar.org';
              if (key === 'STELLAR_NETWORK') return 'Test SDF Network ; September 2015';
              return undefined;
            }),
          },
        },
        { provide: STELLAR_REDIS, useValue: mockRedis },
      ],
    }).compile();
    service = module.get<StellarService>(StellarService);
  });

  describe('anchorHash', () => {
    it('returns txHash and ledger on success', async () => {
      mockLoadAccount.mockResolvedValueOnce({});
      mockSubmitTransaction.mockResolvedValueOnce({ hash: 'tx123', ledger: 42 });

      const result = await service.anchorHash('abc123');

      expect(result).toEqual({ txHash: 'tx123', ledger: 42 });
    });

    it('throws InternalServerErrorException when Stellar submission fails', async () => {
      mockLoadAccount.mockResolvedValueOnce({});
      mockSubmitTransaction.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.anchorHash('abc123')).rejects.toThrow(InternalServerErrorException);
    });

    it('throws when hash is empty', async () => {
      await expect(service.anchorHash('')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('verifyHash', () => {
    it('returns true when hash exists on ledger', async () => {
      mockAccountsCall.mockResolvedValueOnce({ data_attr: { doc_abc123: 'YWJjMTIz' } });

      expect(await service.verifyHash('abc123')).toBe(true);
    });

    it('returns false on 404', async () => {
      mockAccountsCall.mockResolvedValueOnce({ data_attr: {} });

      expect(await service.verifyHash('abc123')).toBe(false);
    });

    it('throws InternalServerErrorException on non-404 error', async () => {
      mockAccountsCall.mockRejectedValueOnce(new Error('Server error'));

      await expect(service.verifyHash('abc123')).rejects.toThrow(InternalServerErrorException);
    });

    it('throws when hash is empty', async () => {
      await expect(service.verifyHash('')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('buildDataKey', () => {
    it('returns doc_-prefixed key', () => {
      expect((service as any).buildDataKey('abc123')).toBe('doc_abc123');
    });

    it('strips non-alphanumeric characters', () => {
      expect((service as any).buildDataKey('abc!@#123')).toBe('doc_abc123');
    });

    it('truncates payload to 58 characters', () => {
      const longHash = 'a'.repeat(100);
      expect((service as any).buildDataKey(longHash)).toBe('doc_' + 'a'.repeat(58));
    });
  });
});
