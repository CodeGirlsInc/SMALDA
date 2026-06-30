import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RefreshAuthDto } from './dto/refresh-auth.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { User, UserRole } from '../users/entities/user.entity';
import { RedisService } from './redis.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
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

    // Fire-and-forget welcome email. SMTP is optional in this stack, so a
    // delivery failure must not block registration. MailService logs (but does
    // not throw) when the transport is unavailable.
    try {
      await this.mailService.sendWelcome(user.email, user.fullName);
    } catch (err) {
      this.logger.warn(
        `welcome email failed for ${user.email}: ${(err as Error).message}`,
      );
    }

    const access_token = await this.generateAccessToken(user);
    return { access_token };
  }

  async login(dto: LoginAuthDto) {
    const user = await this.validateCredentials(dto.email, dto.password);
    const access_token = await this.generateAccessToken(user);
    const refresh_token = await this.generateRefreshToken(user);
    return { access_token, refresh_token };
  }

  async handleOAuthLogin(email: string, fullName?: string) {
    if (!email) {
      throw new BadRequestException(
        'Email is required from the OAuth provider',
      );
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

    // Check if the refresh token has been revoked
    const tokenHash = this.hashToken(refreshToken);
    const isRevoked = await this.redisService.isTokenRevoked(tokenHash);
    if (isRevoked) {
      throw new UnauthorizedException('Token has been revoked');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        {
          secret: this.getRefreshSecret(),
        },
      );

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const access_token = await this.generateAccessToken(user);
      return { access_token };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(
    accessToken: string,
    refreshToken?: string,
  ): Promise<{ message: string }> {
    if (!accessToken) {
      throw new BadRequestException('Access token is required');
    }

    // Add access token to blocklist
    const accessTtl = this.redisService.getTokenRemainingTtl(accessToken);
    const accessHash = this.hashToken(accessToken);
    await this.redisService.addToBlocklist(accessHash, accessTtl);

    // If refresh token is provided, add it to blocklist as well
    if (refreshToken) {
      const refreshTtl = this.redisService.getTokenRemainingTtl(refreshToken);
      const refreshHash = this.hashToken(refreshToken);
      await this.redisService.addToBlocklist(refreshHash, refreshTtl);
    }

    return { message: 'Successfully logged out' };
  }

  private readonly verificationTokens = new Map<string, { token: string; expires: Date }>();
  private readonly resetTokens = new Map<string, { token: string; expires: Date }>();

  async sendVerification(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');
    if (user.isVerified) throw new BadRequestException('Email already verified');

    const token = crypto.randomBytes(32).toString('hex');
    this.verificationTokens.set(email, { token, expires: new Date(Date.now() + 3600_000) });

    this.logger.log(`Verification token for ${email}: ${token}`);
    return { message: 'Verification email sent' };
  }

  async verifyEmail(email: string, token: string) {
    const stored = this.verificationTokens.get(email);
    if (!stored || stored.token !== token) throw new BadRequestException('Invalid token');
    if (stored.expires < new Date()) throw new BadRequestException('Token expired');

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');
    await this.usersService.update(user.id, { isVerified: true } as any);
    this.verificationTokens.delete(email);
    return { message: 'Email verified successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

    const token = crypto.randomBytes(32).toString('hex');
    this.resetTokens.set(email, { token, expires: new Date(Date.now() + 3600_000) });

    this.logger.log(`Password reset token for ${email}: ${token}`);
    return { message: 'Password reset email sent' };
  }

  async resetPassword(email: string, token: string, newPassword: string) {
    const stored = this.resetTokens.get(email);
    if (!stored || stored.token !== token) throw new BadRequestException('Invalid token');
    if (stored.expires < new Date()) throw new BadRequestException('Token expired');

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.usersService.update(user.id, { passwordHash } as any);
    this.resetTokens.delete(email);
    return { message: 'Password reset successfully' };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
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
      expiresIn: this.getRefreshExpiration() as unknown as number,
    });
  }

  private getRefreshSecret() {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      this.configService.get<string>('JWT_SECRET')
    );
  }

  private getRefreshExpiration() {
    return this.configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d';
  }
}
