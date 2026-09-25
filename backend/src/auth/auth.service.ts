import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { UsersService } from '../users/users.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RefreshAuthDto } from './dto/refresh-auth.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  private readonly tokenBlacklist = new Set<string>();
  private readonly refreshTokenBlacklist = new Set<string>();
  private readonly oauthExchangeCodes = new Map<
    string,
    { accessToken: string; refreshToken: string; expiresAt: number }
  >();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
    const refreshToken = dto.refreshToken?.trim();
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    try {
      if (this.refreshTokenBlacklist.has(refreshToken)) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

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

  async logout(accessToken: string | undefined, refreshToken?: string): Promise<void> {
    if (accessToken) this.blacklistToken(accessToken, this.tokenBlacklist);
    if (refreshToken) {
      this.blacklistToken(refreshToken, this.refreshTokenBlacklist);
    }
  }

  async createOAuthExchangeCode(tokens: {
    access_token: string;
    refresh_token: string;
  }): Promise<string> {
    const code = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 60_000;
    this.oauthExchangeCodes.set(code, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    });
    setTimeout(() => this.oauthExchangeCodes.delete(code), 60_000);
    return code;
  }

  async exchangeOAuthCode(code: string): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    const normalizedCode = code.trim();
    const exchange = this.oauthExchangeCodes.get(normalizedCode);
    this.oauthExchangeCodes.delete(normalizedCode);

    if (!exchange || exchange.expiresAt <= Date.now()) {
      throw new UnauthorizedException('OAuth exchange code is invalid or expired');
    }

    return {
      access_token: exchange.accessToken,
      refresh_token: exchange.refreshToken,
    };
  }

  isTokenBlacklisted(token: string): boolean {
    return this.tokenBlacklist.has(token);
  }

  isRefreshTokenBlacklisted(token: string): boolean {
    return this.refreshTokenBlacklist.has(token);
  }

  private blacklistToken(token: string, blacklist: Set<string>): void {
    try {
      const payload = this.jwtService.decode<JwtPayload>(token);
      if (!payload?.exp) return;

      const ttl = payload.exp - Math.floor(Date.now() / 1000);
      if (ttl <= 0) return;

      blacklist.add(token);
      setTimeout(() => blacklist.delete(token), ttl * 1000);
    } catch {
      return;
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

  private getAccessExpiration() {
    return this.configService.get<string>('JWT_EXPIRATION') ?? '15m';
  }
}
