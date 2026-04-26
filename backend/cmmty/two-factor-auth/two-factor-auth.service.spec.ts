import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TwoFactorAuthService, TOTPSecret, TOTPEnableDto, TOTPVerifyDto } from './two-factor-auth.service';
import { User } from '../../src/users/entities/user.entity';
import * as speakeasy from 'speakeasy';

jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(),
  totp: {
    verify: jest.fn(),
  },
}));

describe('TwoFactorAuthService', () => {
  let service: TwoFactorAuthService;
  let userRepository: Repository<User>;
  let mockSpeakeasy: jest.Mocked<typeof speakeasy>;

  const mockUserRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorAuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<TwoFactorAuthService>(TwoFactorAuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    mockSpeakeasy = speakeasy as jest.Mocked<typeof speakeasy>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTOTPSecret', () => {
    it('should generate TOTP secret with QR code URL and backup codes', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
      } as User;

      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        ascii: 'JBSWY3DPEHPK3PXP',
        hex: '4a425357593344504548504b33505850',
        otpauth_url: 'otpauth://totp/SMALDA%20(test%40example.com)?secret=JBSWY3DPEHPK3PXP&issuer=SMALDA',
        google_auth_qr: 'google-auth-qr-url',
      };

      (mockSpeakeasy.generateSecret as jest.Mock).mockReturnValue(mockSecret);

      const result = service.generateTOTPSecret(user);

      expect(mockSpeakeasy.generateSecret).toHaveBeenCalledWith({
        name: `SMALDA (${user.email})`,
        issuer: 'SMALDA',
        length: 32,
      });

      expect(result).toEqual({
        secret: 'JBSWY3DPEHPK3PXP',
        qrCodeUrl: 'otpauth://totp/SMALDA%20(test%40example.com)?secret=JBSWY3DPEHPK3PXP&issuer=SMALDA',
        backupCodes: expect.any(Array),
      });

      expect(result.backupCodes).toHaveLength(10);
      expect(result.backupCodes.every(code => typeof code === 'string' && code.length === 8)).toBe(true);
    });
  });

  describe('enableTwoFactor', () => {
    const userId = 'user-123';
    const enableDto: TOTPEnableDto = {
      secret: 'JBSWY3DPEHPK3PXP',
      token: '123456',
    };

    it('should enable two-factor authentication with valid token', async () => {
      const user = {
        id: userId,
        email: 'test@example.com',
        twoFactorEnabled: false,
      } as User;

      const updatedUser = {
        ...user,
        twoFactorEnabled: true,
        twoFactorSecret: enableDto.secret,
      } as User;

      mockUserRepository.findOne.mockResolvedValue(user);
      mockUserRepository.findOne.mockResolvedValue(updatedUser);
      (mockSpeakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      const result = await service.enableTwoFactor(userId, enableDto);

      expect(mockSpeakeasy.totp.verify).toHaveBeenCalledWith({
        secret: enableDto.secret,
        encoding: 'base32',
        token: enableDto.token,
        window: 2,
      });

      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
        twoFactorSecret: enableDto.secret,
        twoFactorEnabled: true,
        twoFactorBackupCodes: expect.any(String),
      });

      expect(result).toEqual(updatedUser);
    });

    it('should throw error if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.enableTwoFactor(userId, enableDto)).rejects.toThrow('User not found');
    });

    it('should throw error if TOTP token is invalid', async () => {
      const user = {
        id: userId,
        email: 'test@example.com',
      } as User;

      mockUserRepository.findOne.mockResolvedValue(user);
      (mockSpeakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      await expect(service.enableTwoFactor(userId, enableDto)).rejects.toThrow('Invalid TOTP token');
    });
  });

  describe('verifyTwoFactor', () => {
    const user = {
      id: 'user-123',
      email: 'test@example.com',
      twoFactorEnabled: true,
      twoFactorSecret: 'JBSWY3DPEHPK3PXP',
      twoFactorBackupCodes: JSON.stringify(['ABCDEF12', 'GHIJKLMN']),
    } as User;

    const verifyDto: TOTPVerifyDto = {
      token: '123456',
    };

    it('should verify TOTP token successfully', async () => {
      (mockSpeakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      const result = await service.verifyTwoFactor(user, verifyDto);

      expect(mockSpeakeasy.totp.verify).toHaveBeenCalledWith({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: verifyDto.token,
        window: 2,
      });

      expect(result).toBe(true);
    });

    it('should verify backup code successfully', async () => {
      const backupCodeDto: TOTPVerifyDto = {
        token: 'ABCDEF12',
      };

      (mockSpeakeasy.totp.verify as jest.Mock).mockReturnValue(false);
      mockUserRepository.update.mockResolvedValue(undefined);

      const result = await service.verifyTwoFactor(user, backupCodeDto);

      expect(result).toBe(true);
      expect(mockUserRepository.update).toHaveBeenCalledWith(user.id, {
        twoFactorBackupCodes: JSON.stringify(['GHIJKLMN']),
      });
    });

    it('should throw error if two-factor is not enabled', async () => {
      const userWithout2FA = {
        ...user,
        twoFactorEnabled: false,
      } as User;

      await expect(service.verifyTwoFactor(userWithout2FA, verifyDto)).rejects.toThrow(
        'Two-factor authentication is not enabled',
      );
    });

    it('should return false for invalid token and backup code', async () => {
      const invalidDto: TOTPVerifyDto = {
        token: '999999',
      };

      (mockSpeakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      const result = await service.verifyTwoFactor(user, invalidDto);

      expect(result).toBe(false);
    });
  });

  describe('disableTwoFactor', () => {
    const userId = 'user-123';

    it('should disable two-factor authentication', async () => {
      const user = {
        id: userId,
        email: 'test@example.com',
        twoFactorEnabled: true,
      } as User;

      const updatedUser = {
        ...user,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
      } as User;

      mockUserRepository.findOne.mockResolvedValue(user);
      mockUserRepository.findOne.mockResolvedValue(updatedUser);

      const result = await service.disableTwoFactor(userId);

      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
        twoFactorSecret: null,
        twoFactorEnabled: false,
        twoFactorBackupCodes: null,
      });

      expect(result).toEqual(updatedUser);
    });

    it('should throw error if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.disableTwoFactor(userId)).rejects.toThrow('User not found');
    });
  });

  describe('regenerateBackupCodes', () => {
    const userId = 'user-123';

    it('should regenerate backup codes for user with 2FA enabled', async () => {
      const user = {
        id: userId,
        email: 'test@example.com',
        twoFactorEnabled: true,
      } as User;

      mockUserRepository.findOne.mockResolvedValue(user);
      mockUserRepository.update.mockResolvedValue(undefined);

      const result = await service.regenerateBackupCodes(userId);

      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
        twoFactorBackupCodes: expect.any(String),
      });

      expect(result).toHaveLength(10);
      expect(result.every(code => typeof code === 'string' && code.length === 8)).toBe(true);
    });

    it('should throw error if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.regenerateBackupCodes(userId)).rejects.toThrow(
        'Two-factor authentication is not enabled',
      );
    });

    it('should throw error if 2FA is not enabled', async () => {
      const user = {
        id: userId,
        email: 'test@example.com',
        twoFactorEnabled: false,
      } as User;

      mockUserRepository.findOne.mockResolvedValue(user);

      await expect(service.regenerateBackupCodes(userId)).rejects.toThrow(
        'Two-factor authentication is not enabled',
      );
    });
  });

  describe('parseBackupCodes', () => {
    it('should parse valid JSON array', () => {
      const codes = JSON.stringify(['ABCDEF12', 'GHIJKLMN']);
      const result = service.parseBackupCodes(codes);

      expect(result).toEqual(['ABCDEF12', 'GHIJKLMN']);
    });

    it('should return empty array for invalid JSON', () => {
      const invalidJson = 'invalid json';
      const result = service.parseBackupCodes(invalidJson);

      expect(result).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      const result = service.parseBackupCodes('');

      expect(result).toEqual([]);
    });
  });
});
