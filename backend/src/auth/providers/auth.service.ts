import {
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateUserDto } from 'src/users/dto/createUser.dto';
import { VerifyEmailDto } from 'src/users/dto/verifyEmail.dto';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/providers/users.service';
import { ValidateUserProvider } from './validateUser.provider';
import { LoginUserProvider } from './loginUser.provider';
import { LoginUserDto } from '../dto/loginUser.dto';
import { Request } from 'express';
import { RefreshTokenDto } from '../dto/refreshToken.dto';
import { RefreshTokensProvider } from './refreshTokens.provider';
import { RefreshTokenRepositoryOperations } from './RefreshTokenCrud.repository';
import { ForgotPasswordDto } from '../dto/forgotPassword.dto';
import { EmailService } from 'src/email/email.service';
import { ResetPasswordDto } from '../dto/resetPassword.dto';
import { ChangePasswordDto } from '../dto/changeUserPassword.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,

    private readonly validateUserProvider: ValidateUserProvider,

    private readonly loginUserProvider: LoginUserProvider,

    private readonly refreshTokensProvider: RefreshTokensProvider,

    private readonly refreshTokenRepositoryOperations: RefreshTokenRepositoryOperations,

    private readonly emailService: EmailService,
  ) {}

  // CREATE A NEW USER
  public async createSinlgeUser(createUserDto: CreateUserDto) {
    return await this.usersService.createSingleUser(createUserDto);
  }

  // LOGIN USER
  public async loginUser(loginUserDto: LoginUserDto, user: User, req: Request) {
    return await this.loginUserProvider.loginUser(loginUserDto, user, req);
  }

  // VALIDATE USER
  public async validateUser(email: string, password: string) {
    return await this.validateUserProvider.validateUser(email, password);
  }

  // VERIFY EMAIL
  public async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    return await this.usersService.verifyEmail(verifyEmailDto);
  }

  // RESEND VERIFY EMAIL
  public async ResendVerifyEmail(user: User) {
    return await this.usersService.resendVerifyEmail(user);
  }

  // REFRESH TOKEN
  public async refreshToken(
    refreshTokenDto: RefreshTokenDto,
    userId: string,
    req: Request,
  ) {
    return await this.refreshTokensProvider.refreshTokens(
      userId,
      refreshTokenDto.refreshToken,
      req,
    );
  }

  // LOG OUT
  public async logout(userId: string, refreshToken: string) {
    return await this.refreshTokenRepositoryOperations.revokeSingleRefreshToken(
      userId,
      refreshToken,
    );
  }

  // LOG OUT ALL SESSIONS/DEVICES
  public async logoutAllSessions(userId: string) {
    return await this.refreshTokenRepositoryOperations.revokeAllRefreshTokens(
      userId,
    );
  }

  // FORGOT PASSWORD
  public async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    try {
      const { token, user } =
        await this.usersService.forgotPasswordResetToken(forgotPasswordDto);

      await this.emailService.sendPasswordResetEmail(user, token);
    } catch (error) {
      throw new InternalServerErrorException(
        'Error sending password reset email',
      );
    }

    return {
      success: true,
      message: 'Reset password email sent',
    };
  }

  // RESET PASSWORD
  public async resetPassword(resetPasswordDto: ResetPasswordDto) {
    return await this.usersService.resetPassword(resetPasswordDto);
  }

  // CHANGE PASSWORD
  public async changePassword(
    userEmail: string,
    changePasswordDto: ChangePasswordDto,
  ) {
    return await this.usersService.changePassword(userEmail, changePasswordDto);
  }
}
