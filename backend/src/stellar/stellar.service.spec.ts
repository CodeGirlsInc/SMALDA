import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StellarService } from './stellar.service';

describe('StellarService', () => {
  let service: StellarService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'STELLAR_SECRET_KEY') {
        // Valid Stellar testnet secret key format (base32 encoded)
        return 'SAC26QSNSIBA6DPBDXQWMX2GWZD4ZQ7E2QL3Q5GO5S32DWYP3H66LE3Q';
      }
      if (key === 'STELLAR_HORIZON_URL') {
        return 'https://horizon-testnet.stellar.org';
      }
      if (key === 'STELLAR_NETWORK') {
        return 'Test SDF Network ; September 2015';
      }
      return null;
    }),
  };

  beforeEach(async () => {
    configService = mockConfigService as any;
    service = new StellarService(configService);
  });

  describe('Hash Validation', () => {
    const validHash = 'a'.repeat(64); // Valid 64-char hex string

    it('should accept a valid 64-character hex hash', async () => {
      // We can't test the full flow without mocking Horizon,
      // but we can verify the validation doesn't throw
      expect(() => {
        // Access private method via any cast for testing
        (service as any).validateHash(validHash);
      }).not.toThrow();
    });

    it('should reject an empty string with BadRequestException', () => {
      expect(() => {
        (service as any).validateHash('');
      }).toThrow(BadRequestException);
    });

    it('should reject a short string with BadRequestException', () => {
      expect(() => {
        (service as any).validateHash('abc123');
      }).toThrow(BadRequestException);
    });

    it('should reject a non-hex string with BadRequestException', () => {
      expect(() => {
        (service as any).validateHash('g'.repeat(64)); // 'g' is not valid hex
      }).toThrow(BadRequestException);
    });

    it('should reject a string with special characters with BadRequestException', () => {
      expect(() => {
        (service as any).validateHash('a'.repeat(60) + '!@#$');
      }).toThrow(BadRequestException);
    });

    it('should reject a string longer than 64 characters with BadRequestException', () => {
      expect(() => {
        (service as any).validateHash('a'.repeat(65));
      }).toThrow(BadRequestException);
    });

    it('should accept uppercase hex characters', () => {
      expect(() => {
        (service as any).validateHash('A'.repeat(64));
      }).not.toThrow();
    });

    it('should accept mixed case hex characters', () => {
      expect(() => {
        (service as any).validateHash('aB3cD4eF5'.repeat(8).slice(0, 64));
      }).not.toThrow();
    });
  });

  describe('buildDataKey', () => {
    const validHash = 'a'.repeat(64);

    it('should create a data key with doc_ prefix', () => {
      const dataKey = (service as any).buildDataKey(validHash);
      expect(dataKey).toBe(`doc_${'a'.repeat(58)}`);
    });

    it('should truncate hash to 58 characters for the key', () => {
      const dataKey = (service as any).buildDataKey(validHash);
      expect(dataKey.length).toBe(62); // 'doc_' (4) + 58 chars = 62
    });

    it('should reject invalid hash format', () => {
      expect(() => {
        (service as any).buildDataKey('invalid');
      }).toThrow(BadRequestException);
    });
  });
});
