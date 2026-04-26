import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfileService } from './user-profile.service';
import { User, UserRole } from '../../src/users/entities/user.entity';
import { NotFoundException } from '@nestjs/common';

describe('UserProfileService', () => {
  let service: UserProfileService;
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
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return user profile without password hash', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-id-123');

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('test@example.com');
      expect(result.fullName).toBe('John Doe');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getProfile('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update user fullName and return without password hash', async () => {
      const updatedUser = { ...mockUser, fullName: 'Jane Doe' };
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-id-123', { fullName: 'Jane Doe' });

      expect(result.fullName).toBe('Jane Doe');
      expect(result).not.toHaveProperty('passwordHash');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile('non-existent', { fullName: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});