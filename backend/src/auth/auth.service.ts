import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { PasswordReset } from '../entities/password-reset.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EmailService } from '../common/services/email.service';
import { UserRole, AuthProvider } from '../common/enums/user.enum';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordReset)
    private passwordResetRepository: Repository<PasswordReset>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ message: string }> {
    const { email, password, firstName, lastName, phoneNumber } = registerDto;

    // Check if user exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS') || 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate email verification token
    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpires = Date.now() + 
      this.configService.get<number>('EMAIL_VERIFICATION_EXPIRATION');

    // Create user
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phoneNumber,
      roles: [UserRole.USER],
      provider: AuthProvider.LOCAL,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });

    await this.userRepository.save(user);

    // Send verification email
    await this.emailService.sendVerificationEmail(email, verificationToken);

    return {
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  async login(
    loginDto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: Partial<User> }> {
    const { email, password } = loginDto;

    // Find user
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account has been deactivated');
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user, userAgent, ipAddress);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  async refreshAccessToken(
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Find refresh token
    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken, isRevoked: false },
      relations: ['user'],
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is expired
    if (new Date() > tokenRecord.expiresAt) {
      await this.refreshTokenRepository.update(tokenRecord.id, { isRevoked: true });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Verify token
    try {
      await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revoke old token
    await this.refreshTokenRepository.update(tokenRecord.id, { isRevoked: true });

    // Generate new tokens
    return this.generateTokens(tokenRecord.user, userAgent, ipAddress);
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email already verified');
    }

    if (Date.now() > user.emailVerificationExpires) {
      throw new BadRequestException('Verification token expired');
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await this.userRepository.save(user);

    // Send welcome email
    await this.emailService.sendWelcomeEmail(user.email, user.firstName || 'User');

    return { message: 'Email verified successfully' };
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Generate new token
    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpires = Date.now() + 
      this.configService.get<number>('EMAIL_VERIFICATION_EXPIRATION');

    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await this.userRepository.save(user);

    // Send email
    await this.emailService.sendVerificationEmail(email, verificationToken);

    return { message: 'Verification email sent' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      // Don't reveal if user exists
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 
      this.configService.get<number>('PASSWORD_RESET_EXPIRATION');

    // Save reset token
    const passwordReset = this.passwordResetRepository.create({
      token: resetToken,
      userId: user.id,
      expiresAt,
    });
    await this.passwordResetRepository.save(passwordReset);

    // Send email
    await this.emailService.sendPasswordResetEmail(email, resetToken);

    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const resetRecord = await this.passwordResetRepository.findOne({
      where: { token, isUsed: false },
      relations: ['user'],
    });

    if (!resetRecord) {
      throw new BadRequestException('Invalid reset token');
    }

    if (Date.now() > resetRecord.expiresAt) {
      throw new BadRequestException('Reset token expired');
    }

    // Hash new password
    const saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS') || 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    resetRecord.user.password = hashedPassword;
    await this.userRepository.save(resetRecord.user);

    // Mark token as used
    resetRecord.isUsed = true;
    await this.passwordResetRepository.save(resetRecord);

    // Revoke all refresh tokens for security
    await this.refreshTokenRepository.update(
      { userId: resetRecord.user.id },
      { isRevoked: true },
    );

    return { message: 'Password reset successfully' };
  }

  async handleOAuthLogin(
    oauthUser: any,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: Partial<User> }> {
    let user = await this.userRepository.findOne({
      where: [
        { email: oauthUser.email },
        { providerId: oauthUser.providerId, provider: oauthUser.provider },
      ],
    });

    if (!user) {
      // Create new user
      user = this.userRepository.create({
        email: oauthUser.email,
        firstName: oauthUser.firstName,
        lastName: oauthUser.lastName,
        avatar: oauthUser.avatar,
        provider: oauthUser.provider,
        providerId: oauthUser.providerId,
        isEmailVerified: true, // OAuth emails are pre-verified
        roles: [UserRole.USER],
      });
      await this.userRepository.save(user);
    } else if (!user.providerId) {
      // Link OAuth to existing local account
      user.provider = oauthUser.provider;
      user.providerId = oauthUser.providerId;
      user.isEmailVerified = true;
      await this.userRepository.save(user);
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user, userAgent, ipAddress);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  async logout(userId: string, refreshToken: string): Promise<{ message: string }> {
    await this.refreshTokenRepository.update(
      { userId, token: refreshToken },
      { isRevoked: true },
    );

    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string): Promise<{ message: string }> {
    await this.refreshTokenRepository.update(
      { userId },
      { isRevoked: true },
    );

    return { message: 'Logged out from all devices' };
  }

  private async generateTokens(
    user: User,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };

    // Generate access token
    const accessToken = await this.jwtService.signAsync(payload as any, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_EXPIRATION') || '15m') as any,
    } as any);

    // Generate refresh token
    const refreshToken = await this.jwtService.signAsync(payload as any, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d') as any,
    } as any);

    // Calculate expiration date
    const expirationStr = this.configService.get<string>('JWT_REFRESH_EXPIRATION');
    const expirationMs = this.parseExpiration(expirationStr);
    const expiresAt = new Date(Date.now() + expirationMs);

    // Save refresh token
    const tokenRecord = this.refreshTokenRepository.create({
      token: refreshToken,
      userId: user.id,
      expiresAt,
      userAgent,
      ipAddress,
    });
    await this.refreshTokenRepository.save(tokenRecord);

    return { accessToken, refreshToken };
  }

  private parseExpiration(expiration: string): number {
    const unit = expiration.slice(-1);
    const value = parseInt(expiration.slice(0, -1));

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return value;
    }
  }

  private sanitizeUser(user: User): Partial<User> {
    const { password, emailVerificationToken, emailVerificationExpires, ...sanitized } = user;
    return sanitized;
  }
}
