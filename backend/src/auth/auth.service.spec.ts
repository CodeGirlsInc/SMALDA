import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RefreshSession } from './entities/refresh-session.entity';
import { TwoFactorService } from './two-factor.service';
import { TokenRevocationService } from './token-revocation.service';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: '$2b$12$hashedpassword',
  fullName: 'Test User',
  role: 'user' as const,
  isVerified: true,
};

const mockUsersService = {
  findByEmail: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  changeEmail: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue('mock-token'),
  verifyAsync: jest.fn(),
  decode: jest.fn(),
};

const revokedJtis = new Set<string>();
const mockRevocationService = {
  revoke: jest.fn(async (jti: string) => {
    revokedJtis.add(jti);
  }),
  isRevoked: jest.fn(async (jti?: string) => !!jti && revokedJtis.has(jti)),
};

const mockSessionsRepository = {
  save: jest.fn(async (session: object) => ({ id: 'session-1', ...session })),
  create: jest.fn((session: object) => session),
  update: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    revokedJtis.clear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        {
          provide: getRepositoryToken(RefreshSession),
          useValue: mockSessionsRepository,
        },
        { provide: TwoFactorService, useValue: { challenge: jest.fn() } },
        { provide: TokenRevocationService, useValue: mockRevocationService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') return 'test-secret';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleOAuthLogin()', () => {
    it('should create a new user if no existing user with same email', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      });

      const result = await service.handleOAuthLogin(
        'new@example.com',
        'New User',
      );
      expect(mockUsersService.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        fullName: 'New User',
        passwordHash: null,
        role: 'user',
        isVerified: true,
      });
      expect(result.access_token).toBe('mock-token');
    });

    it('should link OAuth to existing OAuth-only account (no password)', async () => {
      const existingOAuthUser = { ...mockUser, passwordHash: null };
      mockUsersService.findByEmail.mockResolvedValue(existingOAuthUser);

      const result = await service.handleOAuthLogin(
        'test@example.com',
        'Test User',
      );
      expect(result.access_token).toBe('mock-token');
      expect(mockUsersService.create).not.toHaveBeenCalled();
    });

    it('should reject OAuth login if email matches a password-based account', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.handleOAuthLogin('test@example.com', 'Test User'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if no email is provided', async () => {
      await expect(
        service.handleOAuthLogin('', 'Test User'),
      ).rejects.toThrow('Email is required');
    });
  });

  describe('OAuth exchange codes', () => {
    it('consumes a code exactly once', async () => {
      const code = await service.createOAuthExchangeCode({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      });

      await expect(service.exchangeOAuthCode(code)).resolves.toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      });
      await expect(service.exchangeOAuthCode(code)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout()', () => {
    const exp = () => Math.floor(Date.now() / 1000) + 3600;

    it('should revoke the jti of a verified token', async () => {
      mockJwtService.verifyAsync.mockResolvedValueOnce({
        sub: 'user-1',
        jti: 'jti-1',
        exp: exp(),
      });

      await service.logout('test-token');
      await expect(service.isTokenBlacklisted('jti-1')).resolves.toBe(true);
    });

    it('revokes both distinct verified access credentials', async () => {
      mockJwtService.verifyAsync.mockImplementation(async (token: string) => ({
        sub: 'user-1',
        jti: `jti-${token}`,
        exp: exp(),
      }));

      await service.logout(
        ['access-token-a', 'access-token-b'],
        'refresh-token',
      );

      await expect(
        service.isTokenBlacklisted('jti-access-token-a'),
      ).resolves.toBe(true);
      await expect(
        service.isTokenBlacklisted('jti-access-token-b'),
      ).resolves.toBe(true);
    });

    it('continues revoking after a malformed access credential', async () => {
      mockJwtService.verifyAsync.mockImplementation(async (token: string) => {
        if (token === 'bad-access-token') throw new Error('invalid');
        return { sub: 'user-1', jti: `jti-${token}`, exp: exp() };
      });

      await service.logout(
        ['bad-access-token', 'good-access-token'],
        'refresh-token',
      );

      await expect(
        service.isTokenBlacklisted('jti-good-access-token'),
      ).resolves.toBe(true);
      await expect(
        service.isTokenBlacklisted('jti-bad-access-token'),
      ).resolves.toBe(false);
    });

    it('should handle malformed tokens gracefully', async () => {
      mockJwtService.verifyAsync.mockRejectedValueOnce(new Error('invalid'));

      await expect(service.logout('bad-token')).resolves.toBeUndefined();
      expect(mockRevocationService.revoke).not.toHaveBeenCalled();
    });
  });

  describe('isTokenBlacklisted()', () => {
    it('should return false for non-revoked tokens', async () => {
      await expect(service.isTokenBlacklisted('nonexistent-jti')).resolves.toBe(
        false,
      );
    });
  });
});
