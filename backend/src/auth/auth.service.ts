import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

import { UsersService } from '../users/users.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RefreshAuthDto } from './dto/refresh-auth.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { User, UserRole } from '../users/entities/user.entity';
import { TokenRevocationService } from './token-revocation.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenRevocationService: TokenRevocationService,
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

    const access_token = await this.generateAccessToken(user);
    const refresh_token = await this.generateRefreshToken(user);
    return { access_token, refresh_token };
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

    const access_token = await this.generateAccessToken(user);
    const refresh_token = await this.generateRefreshToken(user);
    return { access_token, refresh_token };
  }

  async refreshToken(dto: RefreshAuthDto) {
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

      await this.revokeRefreshToken(payload);
      const access_token = await this.generateAccessToken(user);
      const refresh_token = await this.generateRefreshToken(user);
      return { access_token, refresh_token };
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

  private async blacklistAccessToken(token: string): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      await this.revokePayload(payload);
    } catch {
      return;
    }
  }

  private async revokeRefreshTokenFromToken(token: string): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.getRefreshSecret(),
      });
      await this.revokePayload(payload);
    } catch {
      return;
    }
  }

  private async revokeRefreshToken(payload: JwtPayload): Promise<void> {
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

  private async generateRefreshToken(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
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
}
