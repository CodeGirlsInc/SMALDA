import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordChangeService } from './password-change.service';
import { User, UserRole } from '../../src/users/entities/user.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('PasswordChangeService', () => {
  let service: PasswordChangeService;
  let repository: Repository<User>;

  const mockUser: User = {
    id: 'user-id-123',
    email: 'test@example.com',
    passwordHash: 'hashed_password',
    fullName: 'John Doe',
    role: UserRole.USER,
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordChangeService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PasswordChangeService>(PasswordChangeService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('changePassword', () => {
    it('should successfully change password with correct current password', async () => {
      const hashedPassword = await bcrypt.hash('oldPassword123', 12);
      const userWithPassword = { ...mockUser, passwordHash: hashedPassword };
      
      mockRepository.findOne.mockResolvedValue(userWithPassword);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.changePassword('user-id-123', {
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword456',
      });

      expect(result.message).toBe('Password changed successfully');
      expect(mockRepository.update).toHaveBeenCalledWith(
        'user-id-123',
        expect.objectContaining({ passwordHash: expect.any(String) }),
      );
    });

    it('should throw BadRequestException when current password is wrong', async () => {
      const hashedPassword = await bcrypt.hash('oldPassword123', 12);
      const userWithPassword = { ...mockUser, passwordHash: hashedPassword };
      
      mockRepository.findOne.mockResolvedValue(userWithPassword);

      await expect(
        service.changePassword('user-id-123', {
          currentPassword: 'wrongPassword',
          newPassword: 'newPassword456',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when new password is weak (less than 8 chars)', async () => {
      const hashedPassword = await bcrypt.hash('oldPassword123', 12);
      const userWithPassword = { ...mockUser, passwordHash: hashedPassword };
      
      mockRepository.findOne.mockResolvedValue(userWithPassword);

      await expect(
        service.changePassword('user-id-123', {
          currentPassword: 'oldPassword123',
          newPassword: 'short',
        }),
      ).rejects.toThrow();
    });

    it('should throw NotFoundException when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword('non-existent', {
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword456',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user has no password set', async () => {
      const userWithoutPassword = { ...mockUser, passwordHash: null };
      mockRepository.findOne.mockResolvedValue(userWithoutPassword);

      await expect(
        service.changePassword('user-id-123', {
          currentPassword: 'anyPassword',
          newPassword: 'newPassword456',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});