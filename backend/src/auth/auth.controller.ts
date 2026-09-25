import {
  Body,
  Controller,
  Post,
  Get,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { Profile as GoogleProfile } from 'passport-google-oauth20';
import { Profile as GithubProfile } from 'passport-github2';

import { AuthService } from './auth.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RefreshAuthDto } from './dto/refresh-auth.dto';
import { ExchangeOAuthCodeDto } from './dto/exchange-oauth-code.dto';
import { getFrontendUrl } from '../common/cors.config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import {
  ACCESS_TOKEN_COOKIE,
  LEGACY_ACCESS_TOKEN_COOKIE,
  getAccessToken,
  getSessionCookieToken,
} from './access-token';
import { getSessionCookieDomain } from './session-cookie.config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterAuthDto,
    @Res({ passthrough: true }) response?: Response,
  ) {
    const result = await this.authService.register(dto);
    this.setAccessTokenCookie(response, result.access_token);
    return result;
  }

  @Post('login')
  async login(
    @Body() dto: LoginAuthDto,
    @Res({ passthrough: true }) response?: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setAccessTokenCookie(response, result.access_token);
    return result;
  }

  @Post('refresh')
  async refresh(
    @Body() dto: RefreshAuthDto,
    @Res({ passthrough: true }) response?: Response,
  ) {
    const result = await this.authService.refreshToken(dto);
    this.setAccessTokenCookie(response, result.access_token);
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user?: User }) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) response?: Response,
    @Body('refreshToken') refreshToken?: string,
  ) {
    this.assertAllowedMutationOrigin(req);
    const token = getAccessToken(req);
    const normalizedRefreshToken =
      typeof refreshToken === 'string' ? refreshToken.trim() : undefined;
    if (token) {
      await this.authService.logout(token, normalizedRefreshToken);
    } else if (normalizedRefreshToken) {
      await this.authService.logout(undefined, normalizedRefreshToken);
    }
    this.clearAccessTokenCookie(response, ACCESS_TOKEN_COOKIE);
    this.clearAccessTokenCookie(response, LEGACY_ACCESS_TOKEN_COOKIE);
    return { message: 'Logged out successfully' };
  }

  @Post('oauth/exchange')
  async exchangeOAuthCode(
    @Req() req: Request,
    @Body() dto: ExchangeOAuthCodeDto,
    @Res({ passthrough: true }) response?: Response,
  ) {
    this.assertAllowedMutationOrigin(req);
    const tokens = await this.authService.exchangeOAuthCode(dto.code);
    this.setAccessTokenCookie(response, tokens.access_token);
    return tokens;
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    return;
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(
    @Req() req: Request & { user?: GoogleProfile },
    @Res() res: Response,
  ) {
    const profile = req.user;
    const email = profile?.emails?.[0]?.value;
    if (!email) {
      throw new BadRequestException(
        'Google profile did not contain an email address',
      );
    }

    const fullName = this.buildFullName([
      profile?.displayName,
      profile?.name?.givenName,
      profile?.name?.familyName,
    ]);

    const tokens = await this.authService.handleOAuthLogin(
      email,
      fullName || email,
    );

    this.setAccessTokenCookie(res, tokens.access_token);
    const code = await this.authService.createOAuthExchangeCode(tokens);
    return this.redirectWithOAuthCode(code, res);
  }

  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubAuth() {
    return;
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubAuthRedirect(
    @Req() req: Request & { user?: GithubProfile },
    @Res() res: Response,
  ) {
    const profile = req.user;
    const githubId = profile?.id?.toString();
    const email = profile?.emails?.[0]?.value;
    const identifier = email || (githubId ? `github:${githubId}` : null);
    if (!identifier) {
      throw new BadRequestException('GitHub profile could not be identified');
    }

    const fullName =
      this.buildFullName([profile?.displayName, profile?.username]) ||
      identifier;

    const tokens = await this.authService.handleOAuthLogin(
      identifier,
      fullName,
    );

    this.setAccessTokenCookie(res, tokens.access_token);
    const code = await this.authService.createOAuthExchangeCode(tokens);
    return this.redirectWithOAuthCode(code, res);
  }

  private setAccessTokenCookie(
    response: Response | undefined,
    accessToken: string,
  ): void {
    if (!response || typeof response.cookie !== 'function') return;

    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...this.getAccessTokenCookieOptions(),
    });
  }

  private clearAccessTokenCookie(
    response: Response | undefined,
    cookieName: string,
  ): void {
    if (!response || typeof response.clearCookie !== 'function') return;

    response.clearCookie(cookieName, {
      ...this.getAccessTokenCookieOptions(),
    });
  }

  private getAccessTokenCookieOptions() {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    const domain = getSessionCookieDomain(this.configService);

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ('none' as const) : ('lax' as const),
      path: '/',
      ...(domain ? { domain } : {}),
    };
  }

  private redirectWithOAuthCode(code: string, res: Response) {
    const frontendUrl = getFrontendUrl(this.configService);
    const redirectUrl = new URL(frontendUrl);
    redirectUrl.pathname = `${redirectUrl.pathname.replace(/\/$/, '')}/auth/oauth/callback`;
    redirectUrl.search = '';
    redirectUrl.hash = '';
    redirectUrl.searchParams.set('code', code);
    if (typeof res.setHeader === 'function') {
      res.setHeader('Cache-Control', 'no-store');
    }
    return res.redirect(redirectUrl.toString());
  }

  private assertAllowedMutationOrigin(req: Request): void {
    const origin = req.headers.origin;
    const hasSessionCookie = Boolean(getSessionCookieToken(req));
    if (!origin) {
      if (hasSessionCookie) {
        throw new ForbiddenException('Origin is required for cookie logout');
      }
      return;
    }

    let normalizedOrigin: string;
    try {
      normalizedOrigin = new URL(origin).origin;
    } catch {
      throw new ForbiddenException('Origin is not allowed');
    }

    const configuredOrigins = [
      this.configService.get<string>('APP_URL'),
      ...(this.configService.get<string>('FRONTEND_URL') ?? '').split(','),
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) => {
        try {
          return new URL(value.trim()).origin;
        } catch {
          return '';
        }
      });

    if (!configuredOrigins.includes(normalizedOrigin)) {
      throw new ForbiddenException('Origin is not allowed');
    }
  }

  private buildFullName(parts: (string | undefined)[]) {
    return parts
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ');
  }
}
