import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/providers/users.service';
import { ValidateUserProvider } from './validateUser.provider';
import { LoginUserProvider } from './loginUser.provider';
import { RefreshTokensProvider } from './refreshTokens.provider';
import { RefreshTokenRepositoryOperations } from './RefreshTokenCrud.repository';
import { EmailService } from 'src/email/email.service';
import { CreateUserDto } from 'src/users/dto/createUser.dto';
import { LoginUserDto } from '../dto/loginUser.dto';
import { RefreshTokenDto } from '../dto/refreshToken.dto';
import { ForgotPasswordDto } from '../dto/forgotPassword.dto';
import { ResetPasswordDto } from '../dto/resetPassword.dto';
import { ChangePasswordDto } from '../dto/changeUserPassword.dto';
import { VerifyEmailDto } from 'src/users/dto/verifyEmail.dto';
import { User } from 'src/users/entities/user.entity';
import { Request } from 'express';

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    createSingleUser: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerifyEmail: jest.fn(),
    forgotPasswordResetToken: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
  };

  const mockValidateUserProvider = {
    validateUser: jest.fn(),
  };

  const mockLoginUserProvider = {
    loginUser: jest.fn(),
  };

  const mockRefreshTokensProvider = {
    refreshTokens: jest.fn(),
  };

  const mockRefreshTokenRepoOps = {
    revokeSingleRefreshToken: jest.fn(),
    revokeAllRefreshTokens: jest.fn(),
  };

  const mockEmailService = {
    sendPasswordResetEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: ValidateUserProvider, useValue: mockValidateUserProvider },
        { provide: LoginUserProvider, useValue: mockLoginUserProvider },
        { provide: RefreshTokensProvider, useValue: mockRefreshTokensProvider },
        {
          provide: RefreshTokenRepositoryOperations,
          useValue: mockRefreshTokenRepoOps,
        },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a new user', async () => {
    const dto: CreateUserDto = { email: 'test@test.com', password: '123456' };
    mockUsersService.createSingleUser.mockResolvedValue('newUser');
    const result = await service.createSinlgeUser(dto);
    expect(result).toBe('newUser');
    expect(mockUsersService.createSingleUser).toHaveBeenCalledWith(dto);
  });

  it('should login a user', async () => {
    const dto: LoginUserDto = { email: 'test@test.com', password: '123456' };
    const user = {} as User;
    const req = {} as Request;
    mockLoginUserProvider.loginUser.mockResolvedValue('loggedInUser');
    const result = await service.loginUser(dto, user, req);
    expect(result).toBe('loggedInUser');
    expect(mockLoginUserProvider.loginUser).toHaveBeenCalledWith(
      dto,
      user,
      req,
    );
  });

  it('should validate user credentials', async () => {
    mockValidateUserProvider.validateUser.mockResolvedValue('validatedUser');
    const result = await service.validateUser('email', 'pass');
    expect(result).toBe('validatedUser');
  });

  it('should verify email', async () => {
    const dto: VerifyEmailDto = { token: 'abc123' };
    mockUsersService.verifyEmail.mockResolvedValue('verified');
    const result = await service.verifyEmail(dto);
    expect(result).toBe('verified');
  });

  it('should resend verification email', async () => {
    const user = {} as User;
    mockUsersService.resendVerifyEmail.mockResolvedValue('resent');
    const result = await service.ResendVerifyEmail(user);
    expect(result).toBe('resent');
  });

  it('should refresh token', async () => {
    const dto: RefreshTokenDto = { refreshToken: 'token' };
    const req = {} as Request;
    mockRefreshTokensProvider.refreshTokens.mockResolvedValue('refreshed');
    const result = await service.refreshToken(dto, 'userId', req);
    expect(result).toBe('refreshed');
  });

  it('should logout', async () => {
    mockRefreshTokenRepoOps.revokeSingleRefreshToken.mockResolvedValue(
      'loggedOut',
    );
    const result = await service.logout('userId', 'token');
    expect(result).toBe('loggedOut');
  });

  it('should logout all sessions', async () => {
    mockRefreshTokenRepoOps.revokeAllRefreshTokens.mockResolvedValue(
      'allLoggedOut',
    );
    const result = await service.logoutAllSessions('userId');
    expect(result).toBe('allLoggedOut');
  });

  it('should send forgot password email', async () => {
    const dto: ForgotPasswordDto = { email: 'test@test.com' };
    const token = 'resetToken';
    const user = { id: '123' };
    mockUsersService.forgotPasswordResetToken.mockResolvedValue({
      token,
      user,
    });
    mockEmailService.sendPasswordResetEmail.mockResolvedValue(undefined);

    const result = await service.forgotPassword(dto);
    expect(result).toEqual({
      success: true,
      message: 'Reset password email sent',
    });
  });

  it('should throw if forgot password email fails', async () => {
    const dto: ForgotPasswordDto = { email: 'test@test.com' };
    mockUsersService.forgotPasswordResetToken.mockRejectedValue(
      new Error('Failed'),
    );

    await expect(service.forgotPassword(dto)).rejects.toThrow(
      'Error sending password reset email',
    );
  });

  it('should reset password', async () => {
    const dto: ResetPasswordDto = {
      password: 'newpass',
      token: 'resettoken',
    };
    mockUsersService.resetPassword.mockResolvedValue('resetDone');
    const result = await service.resetPassword(dto);
    expect(result).toBe('resetDone');
  });

  it('should change password', async () => {
    const dto: ChangePasswordDto = {
      currentPassword: 'old',
      newPassword: 'new',
    };
    mockUsersService.changePassword.mockResolvedValue('changed');
    const result = await service.changePassword('email@test.com', dto);
    expect(result).toBe('changed');
  });
});
