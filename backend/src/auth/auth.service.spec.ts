import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

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

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
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

  describe('logout()', () => {
    it('should add token to blacklist', async () => {
      mockJwtService.decode.mockReturnValue({
        sub: 'user-1',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      await service.logout('test-token');
      expect(service.isTokenBlacklisted('test-token')).toBe(true);
    });

    it('should handle malformed tokens gracefully', async () => {
      mockJwtService.decode.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(service.logout('bad-token')).resolves.toBeUndefined();
    });
  });

  describe('isTokenBlacklisted()', () => {
    it('should return false for non-blacklisted tokens', () => {
      expect(service.isTokenBlacklisted('nonexistent-token')).toBe(false);
    });
  });
});
