import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { generateSecret, generateURI, verify } from 'otplib';
import * as crypto from 'crypto';

import { UsersService } from '../users/users.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RefreshAuthDto } from './dto/refresh-auth.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EnableTwoFactorDto, DisableTwoFactorDto } from './dto/two-factor.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { User, UserRole } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterAuthDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: UserRole.USER,
      isVerified: false,
    });

    // Send verification email
    const verificationToken = await this.generateVerificationToken(user);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const verificationLink = `${frontendUrl}/auth/verify-email?token=${verificationToken}`;
    await this.mailService.sendVerificationEmail(user.email, user.fullName, verificationLink);

    const access_token = await this.generateAccessToken(user);
    return { access_token };
  }

  async login(dto: LoginAuthDto) {
    const user = await this.validateCredentials(dto.email, dto.password);

    // Check if 2FA is enabled
    if (user.isTwoFactorEnabled && user.twoFactorSecret) {
      // Return flag indicating 2FA is required
      return { requires2FA: true, userId: user.id };
    }

    const access_token = await this.generateAccessToken(user);
    const refresh_token = await this.generateAndStoreRefreshToken(user);
    return { access_token, refresh_token };
  }

  async loginWithTwoFactor(userId: string, code: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await this.verifyTwoFactorDuringLogin(user, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    const access_token = await this.generateAccessToken(user);
    const refresh_token = await this.generateAndStoreRefreshToken(user);
    return { access_token, refresh_token };
  }

  async handleOAuthLogin(email: string, fullName?: string) {
    if (!email) {
      throw new BadRequestException('Email is required from the OAuth provider');
    }

    let user = await this.usersService.findByEmail(email);
    if (!user) {
      user = await this.usersService.create({
        email,
        fullName: fullName || email,
        passwordHash: null,
        role: UserRole.USER,
        isVerified: true,
      });
    }

    const access_token = await this.generateAccessToken(user);
    return { access_token };
  }

  async refreshToken(dto: RefreshAuthDto) {
    const refreshToken = dto.refreshToken?.trim();
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.getRefreshSecret(),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const access_token = await this.generateAccessToken(user);
      return { access_token };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async validateCredentials(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordHash = user.passwordHash;
    if (!passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  private async generateAccessToken(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.signAsync(payload);
  }

  private async generateRefreshToken(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.getRefreshSecret(),
    });
  }

  private getRefreshSecret() {
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }
    return refreshSecret;
  }

  // ==================== PASSWORD RESET ====================
  async forgotPassword(dto: ForgotPasswordDto) {
    // Always return success to prevent email enumeration
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return { message: 'If the email exists, a password reset link has been sent' };
    }

    // Generate short-lived reset token (1 hour)
    const resetToken = await this.generateResetToken(user);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/auth/reset-password?token=${resetToken}`;

    await this.mailService.sendPasswordResetEmail(user.email, user.fullName, resetLink);
    return { message: 'If the email exists, a password reset link has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const payload = await this.verifyResetToken(dto.token);
    if (!payload) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password and update
    const newPasswordHash = await bcrypt.hash(dto.password, 12);
    await this.usersService.update(user.id, { passwordHash: newPasswordHash });

    // Revoke all refresh tokens for security
    await this.usersService.revokeAllUserTokens(user.id);

    return { message: 'Password has been reset successfully' };
  }

  // ==================== EMAIL VERIFICATION ====================
  async verifyEmail(token?: string) {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }

    const payload = await this.verifyVerificationToken(token);
    if (!payload) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.isVerified) {
      return { message: 'Email is already verified' };
    }

    await this.usersService.update(user.id, { isVerified: true });
    return { message: 'Email verified successfully' };
  }

  async resendVerificationEmail(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isVerified) {
      return { message: 'Email is already verified' };
    }

    const verificationToken = await this.generateVerificationToken(user);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const verificationLink = `${frontendUrl}/auth/verify-email?token=${verificationToken}`;

    await this.mailService.sendVerificationEmail(user.email, user.fullName, verificationLink);
    return { message: 'Verification email sent' };
  }

  // ==================== REFRESH TOKEN ROTATION ====================
  async refreshTokenWithRotation(dto: RefreshAuthDto) {
    const refreshToken = dto.refreshToken?.trim();
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.getRefreshSecret(),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Find the refresh token in DB
      const tokenHash = this.hashToken(refreshToken);
      const storedToken = await this.usersService.findRefreshToken(tokenHash);

      if (!storedToken || storedToken.revokedAt) {
        // Token rotation violation - revoke all tokens for security
        await this.usersService.revokeAllUserTokens(user.id);
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Revoke old token
      await this.usersService.revokeRefreshToken(storedToken.id);

      // Generate new tokens
      const access_token = await this.generateAccessToken(user);
      const new_refresh_token = await this.generateAndStoreRefreshToken(user);

      return { access_token, refresh_token: new_refresh_token };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, refreshToken: string, revokeAll = false) {
    if (revokeAll) {
      await this.usersService.revokeAllUserTokens(userId);
      return { message: 'All sessions logged out' };
    }

    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.usersService.findRefreshToken(tokenHash);
    if (storedToken) {
      await this.usersService.revokeRefreshToken(storedToken.id);
    }
    return { message: 'Logged out successfully' };
  }

  // ==================== TWO-FACTOR AUTHENTICATION ====================
  async generateTwoFactorSecret(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isTwoFactorEnabled) {
      throw new ConflictException('2FA is already enabled');
    }

    const secret = generateSecret();
    const otpauthUrl = generateURI({ secret, label: user.email, issuer: 'Smalda' });

    // Store encrypted secret (in production, use proper encryption)
    const encryptedSecret = this.encryptSecret(secret);
    await this.usersService.update(user.id, { twoFactorSecret: encryptedSecret });

    return {
      secret,
      otpauthUrl,
    };
  }

  async enableTwoFactor(userId: string, dto: EnableTwoFactorDto) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException('Generate 2FA secret first');
    }

    const secret = this.decryptSecret(user.twoFactorSecret);
    const isValid = verify({ token: dto.code, secret });

    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    await this.usersService.update(user.id, { isTwoFactorEnabled: true });
    return { message: '2FA enabled successfully' };
  }

  async disableTwoFactor(userId: string, dto: DisableTwoFactorDto) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.isTwoFactorEnabled) {
      throw new ConflictException('2FA is not enabled');
    }

    const secret = this.decryptSecret(user.twoFactorSecret!);
    const isValid = verify({ token: dto.code, secret });

    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    await this.usersService.update(user.id, {
      isTwoFactorEnabled: false,
      twoFactorSecret: null,
    });
    return { message: '2FA disabled successfully' };
  }

  async verifyTwoFactorDuringLogin(user: User, code: string): Promise<boolean> {
    if (!user.isTwoFactorEnabled || !user.twoFactorSecret) {
      return true; // 2FA not enabled, skip verification
    }

    const secret = this.decryptSecret(user.twoFactorSecret);
    const result = verify({ token: code, secret });
    return !!result && typeof result === 'object' ? true : false;
  }

  // ==================== HELPER METHODS ====================
  private async generateResetToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'reset',
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: '1h',
    });
  }

  private async verifyResetToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload & { type?: string }>(token, {
        secret: this.getRefreshSecret(),
      });

      if (payload.type !== 'reset') {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  private async generateVerificationToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'verification',
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: '24h',
    });
  }

  private async verifyVerificationToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload & { type?: string }>(token, {
        secret: this.getRefreshSecret(),
      });

      if (payload.type !== 'verification') {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  private async generateAndStoreRefreshToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.getRefreshSecret(),
      expiresIn: '7d',
    });

    // Store token hash in DB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const tokenHash = this.hashToken(refreshToken);
    await this.usersService.saveRefreshToken(user.id, tokenHash, expiresAt);

    return refreshToken;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private encryptSecret(secret: string): string {
    // In production, use proper encryption (e.g., AES-256-GCM)
    // For now, simple base64 encoding as placeholder
    return Buffer.from(secret).toString('base64');
  }

  private decryptSecret(encrypted: string): string {
    // In production, use proper decryption
    return Buffer.from(encrypted, 'base64').toString('utf-8');
  }
}
