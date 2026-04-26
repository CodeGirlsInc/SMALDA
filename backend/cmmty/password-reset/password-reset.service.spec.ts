import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordResetService } from './password-reset.service';
import { User, UserRole } from '../../src/users/entities/user.entity';
import { PasswordResetToken } from './password-reset-token.entity';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let mockUserRepository;
  let mockPasswordResetRepository;

  const mockUser: User = {
    id: 'user-id-123',
    email: 'test@example.com',
    passwordHash: 'old_password_hash',
    fullName: 'Jane Doe',
    role: UserRole.USER,
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockUserRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    mockPasswordResetRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(PasswordResetToken),
          useValue: mockPasswordResetRepository,
        },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('forgotPassword', () => {
    it('should return 200 and create a password reset token when email exists', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockPasswordResetRepository.save.mockResolvedValue({
        id: 'token-id',
        token: 'generated-token',
        user: mockUser,
        expiresAt: new Date(Date.now() + 3600000),
        used: false,
      });

      const result = await service.forgotPassword({ email: 'test@example.com' });

      expect(result.message).toContain('If the email is registered');
      expect(mockPasswordResetRepository.create).toHaveBeenCalled();
      expect(mockPasswordResetRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
          user: mockUser,
          used: false,
        }),
      );
    });

    it('should return 200 and not create a token when email does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'missing@example.com' });

      expect(result.message).toContain('If the email is registered');
      expect(mockPasswordResetRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset the password when token is valid and unused', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      const resetRecord: PasswordResetToken = {
        id: 'reset-id-123',
        token: 'valid-token',
        user: mockUser,
        expiresAt: futureDate,
        used: false,
        createdAt: new Date(),
      };

      mockPasswordResetRepository.findOne.mockResolvedValue(resetRecord);
      mockUserRepository.update.mockResolvedValue({ affected: 1 });
      mockPasswordResetRepository.save.mockResolvedValue({ ...resetRecord, used: true });

      const result = await service.resetPassword({
        token: 'valid-token',
        newPassword: 'newPassword123',
      });

      expect(result.message).toBe('Password reset successfully');
      expect(mockUserRepository.update).toHaveBeenCalledWith(mockUser.id, {
        passwordHash: expect.any(String),
      });
      expect(mockPasswordResetRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ used: true }),
      );
    });

    it('should reject when token is missing or invalid', async () => {
      mockPasswordResetRepository.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'bad-token', newPassword: 'newPassword123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when token is expired', async () => {
      const expiredRecord: PasswordResetToken = {
        id: 'reset-id-123',
        token: 'expired-token',
        user: mockUser,
        expiresAt: new Date(Date.now() - 1000),
        used: false,
        createdAt: new Date(Date.now() - 3600000),
      };

      mockPasswordResetRepository.findOne.mockResolvedValue(expiredRecord);

      await expect(
        service.resetPassword({ token: 'expired-token', newPassword: 'newPassword123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when token has already been used', async () => {
      const usedRecord: PasswordResetToken = {
        id: 'reset-id-123',
        token: 'used-token',
        user: mockUser,
        expiresAt: new Date(Date.now() + 3600000),
        used: true,
        createdAt: new Date(Date.now() - 3600000),
      };

      mockPasswordResetRepository.findOne.mockResolvedValue(usedRecord);

      await expect(
        service.resetPassword({ token: 'used-token', newPassword: 'newPassword123' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
