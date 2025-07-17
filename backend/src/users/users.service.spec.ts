import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UserCrudActivitiesProvider } from './userCrud.provider';
import { EmailVerificationTokenProvider } from './emailVerificationToken.provider';
import { EmailService } from 'src/email/email.service';
import { VerifyEmailProvider } from './verifyEmail.provider';
import { ResendEmailVerificationProvider } from './resendVerifyEmail.provider';
import { FindOneUserByEmailProvider } from './findOneUserByEmail.provider';
import { FindOneUserByIdProvider } from './findOneUserById.provider';
import { PasswordResetTokenProvider } from './passwordResetToken.provider';
import { ResetPasswordProvider } from './passwordReset.provider';
import { ChangePasswordProvider } from './changeUserPassword.provider';
import { GetUserProfileProvider } from './getUserProfile.provider';
import { UpdateOneUserProvider } from './updateOneUser.provider';
import { FindAllUsersProvider } from './findAllUsers.provider';
import { DeleteOneUserProvider } from './deleteOneUser.provider';

describe('UsersService', () => {
  let service: UsersService;

  // Mocks
  const mockUser = { id: '123', email: 'test@example.com' };

  const mockUserCrud = {
    createSingleUser: jest.fn().mockResolvedValue(mockUser),
  };

  const mockEmailVerificationTokenProvider = {
    getEmailVerificationToken: jest.fn().mockResolvedValue('token123'),
  };

  const mockEmailService = {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  };

  const mockVerifyEmailProvider = {
    verifyEmail: jest.fn().mockResolvedValue({ success: true }),
  };

  const mockResendVerifyEmailProvider = {
    resendEmailVerification: jest.fn().mockResolvedValue({ sent: true }),
  };

  const mockFindOneUserByEmailProvider = {
    findUserByEmail: jest.fn().mockResolvedValue(mockUser),
  };

  const mockFindOneUserByIdProvider = {
    findOneUserById: jest.fn().mockResolvedValue(mockUser),
  };

  const mockPasswordResetProvider = {
    setPasswordResetToken: jest
      .fn()
      .mockResolvedValue({ token: 'reset-token' }),
  };

  const mockResetPasswordProvider = {
    resetPassword: jest.fn().mockResolvedValue({ success: true }),
  };

  const mockChangePasswordProvider = {
    changePassword: jest.fn().mockResolvedValue({ changed: true }),
  };

  const mockGetUserProfileProvider = {
    getUserProfile: jest.fn().mockResolvedValue({ profile: 'profile-data' }),
  };

  const mockUpdateUserProvider = {
    updateOneUser: jest.fn().mockResolvedValue({ updated: true }),
  };

  const mockFindAllUsersProvider = {
    allUsers: jest.fn().mockResolvedValue([mockUser]),
  };

  const mockDeleteOneUserProvider = {
    deleteUser: jest.fn().mockResolvedValue({ deleted: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UserCrudActivitiesProvider, useValue: mockUserCrud },
        {
          provide: EmailVerificationTokenProvider,
          useValue: mockEmailVerificationTokenProvider,
        },
        { provide: EmailService, useValue: mockEmailService },
        { provide: VerifyEmailProvider, useValue: mockVerifyEmailProvider },
        {
          provide: ResendEmailVerificationProvider,
          useValue: mockResendVerifyEmailProvider,
        },
        {
          provide: FindOneUserByEmailProvider,
          useValue: mockFindOneUserByEmailProvider,
        },
        {
          provide: FindOneUserByIdProvider,
          useValue: mockFindOneUserByIdProvider,
        },
        {
          provide: PasswordResetTokenProvider,
          useValue: mockPasswordResetProvider,
        },
        { provide: ResetPasswordProvider, useValue: mockResetPasswordProvider },
        {
          provide: ChangePasswordProvider,
          useValue: mockChangePasswordProvider,
        },
        {
          provide: GetUserProfileProvider,
          useValue: mockGetUserProfileProvider,
        },
        { provide: UpdateOneUserProvider, useValue: mockUpdateUserProvider },
        { provide: FindAllUsersProvider, useValue: mockFindAllUsersProvider },
        { provide: DeleteOneUserProvider, useValue: mockDeleteOneUserProvider },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a user and send verification email', async () => {
    const dto = { email: 'test@example.com', password: 'password' };
    const result = await service.createSingleUser(dto as any);
    expect(result).toEqual(mockUser);
    expect(
      mockEmailVerificationTokenProvider.getEmailVerificationToken,
    ).toHaveBeenCalled();
    expect(mockEmailService.sendVerificationEmail).toHaveBeenCalled();
  });

  it('should find user by email', async () => {
    const result = await service.findOneUserByEmail('test@example.com');
    expect(result).toEqual(mockUser);
  });

  it('should find user by ID', async () => {
    const result = await service.findOneUserById('123');
    expect(result).toEqual(mockUser);
  });

  it('should verify email', async () => {
    const result = await service.verifyEmail({ token: 'abc' } as any);
    expect(result).toEqual({ success: true });
  });

  it('should resend verification email', async () => {
    const result = await service.resendVerifyEmail(mockUser as any);
    expect(result).toEqual({ sent: true });
  });

  it('should set forgot password reset token', async () => {
    const result = await service.forgotPasswordResetToken({
      email: 'test@example.com',
    } as any);
    expect(result).toEqual({ token: 'reset-token' });
  });

  it('should reset password', async () => {
    const result = await service.resetPassword({
      token: 'abc',
      password: 'newpass',
    } as any);
    expect(result).toEqual({ success: true });
  });

  it('should change password', async () => {
    const result = await service.changePassword('test@example.com', {
      oldPassword: '123',
      newPassword: '456',
    } as any);
    expect(result).toEqual({ changed: true });
  });

  it('should get user profile', async () => {
    const result = await service.userProfile(mockUser as any);
    expect(result).toEqual({ profile: 'profile-data' });
  });

  it('should update user', async () => {
    const result = await service.updateUser('123', { name: 'Updated' } as any);
    expect(result).toEqual({ updated: true });
  });

  it('should get all users', async () => {
    const result = await service.getAllUsers();
    expect(result).toEqual([mockUser]);
  });

  it('should get single user by id', async () => {
    const result = await service.getSingleUser('123');
    expect(result).toEqual(mockUser);
  });

  it('should delete a user', async () => {
    const result = await service.deleteSingleUser('123');
    expect(result).toEqual({ deleted: true });
  });
});
