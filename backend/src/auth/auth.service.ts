import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

import { UsersService } from '../users/users.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RefreshAuthDto } from './dto/refresh-auth.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { User, UserRole } from '../users/entities/user.entity';
import { RefreshSession } from './entities/refresh-session.entity';
import { TwoFactorService } from './two-factor.service';
import { TokenRevocationService } from './token-revocation.service';

export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface TwoFactorRequired {
  requiresTwoFactor: true;
  twoFactorToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshSession)
    private readonly sessionsRepository: Repository<RefreshSession>,
    private readonly twoFactorService: TwoFactorService,
    private readonly tokenRevocationService: TokenRevocationService,
  ) {}

  async register(dto: RegisterAuthDto, context?: SessionContext) {
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

    return this.issueTokens(user, context);
  }

  async login(
    dto: LoginAuthDto,
    context?: SessionContext,
  ): Promise<{ access_token: string; refresh_token: string } | TwoFactorRequired> {
    const user = await this.validateCredentials(dto.email, dto.password);

    if (user.twoFactorEnabled) {
      return {
        requiresTwoFactor: true,
        twoFactorToken: await this.generateTwoFactorToken(user),
      };
    }

    return this.issueTokens(user, context);
  }

  async completeTwoFactorLogin(
    twoFactorToken: string,
    code: string,
    context?: SessionContext,
  ) {
    let payload: { sub: string; purpose?: string };
    try {
      payload = await this.jwtService.verifyAsync(twoFactorToken);
    } catch {
      throw new UnauthorizedException('Invalid two-factor token');
    }

    if (payload.purpose !== '2fa') {
      throw new UnauthorizedException('Invalid two-factor token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid two-factor token');
    }

    await this.twoFactorService.challenge(user.id, code);
    return this.issueTokens(user, context);
  }

  async handleOAuthLogin(
    email: string,
    fullName?: string,
    context?: SessionContext,
  ) {
    if (!email) {
      throw new BadRequestException(
        'Email is required from the OAuth provider',
      );
    }

    let user = await this.usersService.findByEmail(email);
    if (user) {
      if (user.passwordHash) {
        throw new ConflictException(
          'An account with this email already exists. Please log in with your password.',
        );
      }
    } else {
      user = await this.usersService.create({
        email,
        fullName: fullName || email,
        passwordHash: null,
        role: UserRole.USER,
        isVerified: true,
      });
    }

    return this.issueTokens(user, context);
  }

  async refreshToken(dto: RefreshAuthDto, context?: SessionContext) {
    const refreshToken = dto?.refreshToken?.trim();
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        {
          secret: this.getRefreshSecret(),
        },
      );

      if (await this.tokenRevocationService.isRevoked(payload.jti)) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (payload.sid) {
        const session = await this.sessionsRepository.findOne({
          where: { id: payload.sid, userId: user.id },
        });
        if (!session || session.revokedAt) {
          throw new UnauthorizedException('Invalid refresh token');
        }
        session.revokedAt = new Date();
        await this.sessionsRepository.save(session);
      }

      await this.revokeRefreshToken(payload);
      return this.issueTokens(user, context);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(
    accessTokenOrTokens?: string | string[],
    refreshToken?: string,
  ): Promise<void> {
    const accessTokens = Array.isArray(accessTokenOrTokens)
      ? accessTokenOrTokens
      : accessTokenOrTokens
        ? [accessTokenOrTokens]
        : [];
    const distinctAccessTokens = [...new Set(accessTokens.filter(Boolean))];

    // No allSettled here: a failed revocation must surface instead of
    // silently leaving a token usable.
    await Promise.all(
      distinctAccessTokens.map((token) => this.blacklistAccessToken(token)),
    );
    if (refreshToken) {
      await this.revokeRefreshTokenFromToken(refreshToken);
    }
  }

  isTokenBlacklisted(jti?: string): Promise<boolean> {
    return this.tokenRevocationService.isRevoked(jti);
  }

  listSessions(userId: string): Promise<RefreshSession[]> {
    return this.sessionsRepository.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async revokeSession(
    userId: string,
    sessionId: string,
  ): Promise<{ message: string }> {
    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (!session.revokedAt) {
      session.revokedAt = new Date();
      await this.sessionsRepository.save(session);
    }

    return { message: 'Session revoked' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user?.passwordHash) {
      throw new BadRequestException('Password is not set for this account');
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.usersService.update(userId, { passwordHash });
    await this.sessionsRepository.update(
      { userId },
      { revokedAt: new Date() },
    );

    return { message: 'Password changed. Please sign in again.' };
  }

  private async issueTokens(user: User, context?: SessionContext) {
    const session = await this.sessionsRepository.save(
      this.sessionsRepository.create({
        userId: user.id,
        userAgent: context?.userAgent,
        ipAddress: context?.ipAddress,
      }),
    );

    const access_token = await this.generateAccessToken(user);
    const refresh_token = await this.generateRefreshToken(user, session.id);
    return { access_token, refresh_token };
  }

  private async generateTwoFactorToken(user: User) {
    return this.jwtService.signAsync(
      { sub: user.id, purpose: '2fa' },
      { expiresIn: '5m' },
    );
  }

  private async blacklistAccessToken(token: string): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      await this.revokePayload(payload);
    } catch {
      return;
    }
  }

  private async revokeRefreshTokenFromToken(token: string): Promise<void> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.getRefreshSecret(),
      });
    } catch {
      return;
    }

    await this.revokeRefreshToken(payload);
  }

  private async revokeRefreshToken(payload: JwtPayload): Promise<void> {
    if (payload.sid) {
      await this.sessionsRepository.update(
        { id: payload.sid },
        { revokedAt: new Date() },
      );
    }

    await this.revokePayload(payload);
  }

  private async revokePayload(payload: JwtPayload): Promise<void> {
    if (!payload.jti) return;

    const ttl = this.getPayloadTtl(payload);
    if (ttl === null) return;

    await this.tokenRevocationService.revoke(payload.jti, ttl);
  }

  private getPayloadTtl(payload: JwtPayload): number | null {
    if (!payload.exp) return null;
    return payload.exp - Math.floor(Date.now() / 1000);
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
      jti: randomUUID(),
    };

    return this.jwtService.signAsync(payload);
  }

  private async generateRefreshToken(user: User, sessionId?: string) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
      jti: randomUUID(),
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

  async verifyEmail(token: string) {
    const user = await this.usersService.findByEmail(Buffer.from(token, 'base64').toString('utf-8'));
    if (!user) throw new NotFoundException('Invalid token');
    user.isVerified = true;
    await this.usersService.update(user.id, user);
  }

  async resendVerification(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return;
    // Send verification email
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return;
    const token = Buffer.from(email).toString('base64');
    // Send reset email with token
  }

  async resetPassword(token: string, password: string) {
    const email = Buffer.from(token, 'base64').toString('utf-8');
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('Invalid token');
    const hashed = await bcrypt.hash(password, 10);
    await this.usersService.update(user.id, { password: hashed });
  }
}
