import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { StellarService, STELLAR_REDIS } from './stellar.service';

// ── Constants ────────────────────────────────────────────────────────────────
const VALID_HASH = 'a'.repeat(64);           // valid 64-char hex
const SHORT_HASH  = 'abc123';                // too short
const LONG_HASH   = 'a'.repeat(65);          // too long
const NON_HEX     = 'z'.repeat(64);          // right length, wrong chars
const EMPTY_HASH  = '';

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockLoadAccount  = jest.fn();
const mockSubmitTx     = jest.fn();
const mockAccountData  = jest.fn();
const mockRedisGet     = jest.fn();
const mockRedisSet     = jest.fn();

// Intercept `new Horizon.Server(...)` so no real network calls happen
jest.mock('stellar-sdk', () => {
  const actual = jest.requireActual('stellar-sdk');
  return {
    ...actual,
    Keypair: {
      fromSecret: jest.fn().mockReturnValue({
        publicKey: () => 'GTEST_PUBLIC_KEY',
        sign: jest.fn(),
      }),
    },
    // Horizon namespace mock
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        loadAccount:     mockLoadAccount,
        submitTransaction: mockSubmitTx,
        accountData:     mockAccountData,
      })),
    },
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      setTimeout:   jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({ sign: jest.fn() }),
    })),
    Operation: { manageData: jest.fn() },
  };
});

// ── Test suite ────────────────────────────────────────────────────────────────
describe('StellarService', () => {
  let service: StellarService;
  const mockRedis = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue('OK') };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default happy-path stubs
    mockLoadAccount.mockResolvedValue({});
    mockSubmitTx.mockResolvedValue({ hash: 'tx123', ledger: 42 });
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                STELLAR_SECRET_KEY:  'STEST_SECRET_KEY_32CHARS_PADDING12345',
                STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
                STELLAR_NETWORK:     'Test SDF Network ; September 2015',
              }[key]),
          },
        },
        {
          provide: STELLAR_REDIS,
          useValue: { get: mockRedisGet, set: mockRedisSet },
        },
      ],
    }).compile();

    service = module.get<StellarService>(StellarService);
  });

  // ── validateHash (private — tested via public API) ────────────────────────
  describe('hash format validation', () => {
    const invalidCases: [string, string][] = [
      ['empty string',            EMPTY_HASH],
      ['too short (6 chars)',     SHORT_HASH],
      ['too long (65 chars)',     LONG_HASH],
      ['non-hex chars (z×64)',    NON_HEX],
    ];

    describe('anchorHash rejects', () => {
      it.each(invalidCases)('%s', async (_label, hash) => {
        await expect(service.anchorHash(hash)).rejects.toThrow(BadRequestException);
      });
    });

    describe('verifyHash rejects', () => {
      it.each(invalidCases)('%s', async (_label, hash) => {
        await expect(service.verifyHash(hash)).rejects.toThrow(BadRequestException);
      });
    });

    it('anchorHash accepts a valid 64-char hex hash', async () => {
      await expect(service.anchorHash(VALID_HASH)).resolves.toEqual({
        txHash: 'tx123',
        ledger: 42,
      });
    });

    it('verifyHash accepts a valid 64-char hex hash', async () => {
      mockAccountData.mockResolvedValue({});
      await expect(service.verifyHash(VALID_HASH)).resolves.toBe(true);
    });

    it('accepts uppercase hex (case-insensitive regex)', async () => {
      const upperHex = 'A'.repeat(64);
      await expect(service.anchorHash(upperHex)).resolves.toBeDefined();
    });
  });

  // ── verifyHash caching ────────────────────────────────────────────────────
  describe('verifyHash caching', () => {
    it('returns cached true without hitting Stellar', async () => {
      mockRedisGet.mockResolvedValue('true');
      const result = await service.verifyHash(VALID_HASH);
      expect(result).toBe(true);
      expect(mockAccountData).not.toHaveBeenCalled();
    });

    it('returns cached false without hitting Stellar', async () => {
      mockRedisGet.mockResolvedValue('false');
      const result = await service.verifyHash(VALID_HASH);
      expect(result).toBe(false);
      expect(mockAccountData).not.toHaveBeenCalled();
    });

    it('returns false and caches with TTL when Stellar returns 404', async () => {
      mockAccountData.mockRejectedValue({ response: { status: 404 } });
      const result = await service.verifyHash(VALID_HASH);
      expect(result).toBe(false);
      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining('stellar:verify:'),
        'false',
        'EX',
        60,
      );
    });

    it('throws InternalServerErrorException on unexpected Stellar error', async () => {
      mockAccountData.mockRejectedValue(new Error('network timeout'));
      await expect(service.verifyHash(VALID_HASH)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ── anchorHash error handling ─────────────────────────────────────────────
  describe('anchorHash error handling', () => {
    it('throws InternalServerErrorException when Stellar submission fails', async () => {
      mockSubmitTx.mockRejectedValue(new Error('submission failed'));
      await expect(service.anchorHash(VALID_HASH)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});