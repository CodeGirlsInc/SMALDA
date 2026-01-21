import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { PasswordReset } from '../entities/password-reset.entity';
import { EmailService } from '../common/services/email.service';
import { UserRole, AuthProvider } from '../common/enums/user.enum';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let refreshTokenRepository: Repository<RefreshToken>;
  let passwordResetRepository: Repository<PasswordReset>;
  let jwtService: JwtService;
  let emailService: EmailService;

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    password: 'hashedPassword',
    firstName: 'Test',
    lastName: 'User',
    roles: [UserRole.USER],
    isEmailVerified: true,
    isActive: true,
    provider: AuthProvider.LOCAL,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockRefreshTokenRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockPasswordResetRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        BCRYPT_SALT_ROUNDS: 10,
        EMAIL_VERIFICATION_EXPIRATION: 86400000,
        PASSWORD_RESET_EXPIRATION: 3600000,
        JWT_SECRET: 'test-secret',
        JWT_EXPIRATION: '15m',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_REFRESH_EXPIRATION: '7d',
      };
      return config[key];
    }),
  };

  const mockEmailService = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    sendWelcomeEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepository,
        },
        {
          provide: getRepositoryToken(PasswordReset),
          useValue: mockPasswordResetRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    refreshTokenRepository = module.get<Repository<RefreshToken>>(
      getRepositoryToken(RefreshToken),
    );
    passwordResetRepository = module.get<Repository<PasswordReset>>(
      getRepositoryToken(PasswordReset),
    );
    jwtService = module.get<JwtService>(JwtService);
    emailService = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const registerDto = {
        email: 'new@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockEmailService.sendVerificationEmail.mockResolvedValue(undefined);

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('message');
      expect(mockUserRepository.findOne).toHaveBeenCalled();
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('should throw ConflictException if user already exists', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'Password123!',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should successfully login a user', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
      mockJwtService.signAsync.mockResolvedValue('mock-token');
      mockRefreshTokenRepository.create.mockReturnValue({});
      mockRefreshTokenRepository.save.mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if email not verified', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const unverifiedUser = { ...mockUser, isEmailVerified: false };
      mockUserRepository.findOne.mockResolvedValue(unverifiedUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyEmail', () => {
    it('should successfully verify email', async () => {
      const token = 'valid-token';
      const user = {
        ...mockUser,
        isEmailVerified: false,
        emailVerificationToken: token,
        emailVerificationExpires: Date.now() + 10000,
      };

      mockUserRepository.findOne.mockResolvedValue(user);
      mockUserRepository.save.mockResolvedValue({ ...user, isEmailVerified: true });
      mockEmailService.sendWelcomeEmail.mockResolvedValue(undefined);

      const result = await service.verifyEmail(token);

      expect(result).toHaveProperty('message');
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token', async () => {
      const refreshToken = 'valid-refresh-token';
      const tokenRecord = {
        id: '1',
        token: refreshToken,
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 100000),
        isRevoked: false,
        user: mockUser,
      };

      mockRefreshTokenRepository.findOne.mockResolvedValue(tokenRecord);
      mockJwtService.verifyAsync.mockResolvedValue({});
      mockJwtService.signAsync.mockResolvedValue('new-token');
      mockRefreshTokenRepository.create.mockReturnValue({});
      mockRefreshTokenRepository.save.mockResolvedValue({});

      const result = await service.refreshAccessToken(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockPasswordResetRepository.create.mockReturnValue({});
      mockPasswordResetRepository.save.mockResolvedValue({});
      mockEmailService.sendPasswordResetEmail.mockResolvedValue(undefined);

      const result = await service.forgotPassword('test@example.com');

      expect(result).toHaveProperty('message');
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled();
    });
  });
});
