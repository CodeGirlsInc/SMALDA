import {
  Body,
  Controller,
  Post,
  Get,
  Header,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  ForbiddenException,
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
import {
  getFrontendUrl,
  isAllowedFrontendOrigin,
} from '../common/cors.config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  ACCESS_COOKIE_NAME,
  AuthTokens,
  REFRESH_COOKIE_NAME,
  clearAuthCookies,
  getCookieValue,
  setAuthCookies,
} from './auth-cookie';
import { User } from '../users/entities/user.entity';

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
    @Req() request?: Request,
  ) {
    this.assertTrustedBrowserRequest(request);
    const tokens = await this.authService.register(dto);
    setAuthCookies(response, tokens, this.configService);
    return tokens;
  }

  @Post('login')
  async login(
    @Body() dto: LoginAuthDto,
    @Res({ passthrough: true }) response?: Response,
    @Req() request?: Request,
  ) {
    this.assertTrustedBrowserRequest(request);
    const tokens = await this.authService.login(dto);
    setAuthCookies(response, tokens, this.configService);
    return tokens;
  }

  @Post('refresh')
  async refresh(
    @Body() dto: RefreshAuthDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response?: Response,
  ) {
    this.assertTrustedBrowserRequest(request);
    const cookieRefreshToken = getCookieValue(
      request.headers.cookie,
      REFRESH_COOKIE_NAME,
    );
    const tokens = await this.authService.refreshToken({
      refreshToken: cookieRefreshToken ?? dto?.refreshToken,
    });
    setAuthCookies(response, tokens, this.configService);
    return tokens;
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response?: Response,
  ) {
    this.assertTrustedBrowserRequest(request);
    const bearerToken = this.getBearerToken(request.headers.authorization);
    const cookieAccessToken = getCookieValue(
      request.headers.cookie,
      ACCESS_COOKIE_NAME,
    );
    const accessTokens = [
      ...new Set([bearerToken, cookieAccessToken].filter(Boolean)),
    ] as string[];
    const refreshToken = getCookieValue(
      request.headers.cookie,
      REFRESH_COOKIE_NAME,
    );

    try {
      await this.authService.logout(accessTokens, refreshToken);
    } finally {
      clearAuthCookies(response, this.configService);
    }
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: Request & { user?: User }) {
    const user = request.user;
    if (!user) throw new BadRequestException('Authenticated user is required');

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isVerified: user.isVerified,
      preferredLanguage: user.preferredLanguage,
      twoFactorEnabled: user.twoFactorEnabled,
    };
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

    return this.redirectWithCookies(tokens, res);
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
      this.buildFullName([
        profile?.displayName,
        profile?.username,
      ]) || identifier;

    const tokens = await this.authService.handleOAuthLogin(
      identifier,
      fullName,
    );

    return this.redirectWithCookies(tokens, res);
  }

  private redirectWithCookies(tokens: AuthTokens, res: Response) {
    setAuthCookies(res, tokens, this.configService);
    const redirectUrl = new URL(getFrontendUrl(this.configService));
    const basePath = redirectUrl.pathname.replace(/\/+$/, "");
    redirectUrl.pathname = `${basePath}/auth/oauth/callback`;
    redirectUrl.search = '';
    redirectUrl.hash = new URLSearchParams({
      access_token: tokens.access_token,
    }).toString();
    return res.redirect(redirectUrl.toString());
  }

  private assertTrustedBrowserRequest(request?: Request): void {
    if (!request) return;

    if (request.headers['sec-fetch-site'] === 'cross-site') {
      throw new ForbiddenException('Request origin is not allowed');
    }

    const origin = request.headers.origin;
    if (origin) {
      if (!isAllowedFrontendOrigin(this.configService, origin)) {
        throw new ForbiddenException('Request origin is not allowed');
      }
      return;
    }

    const referer = request.headers.referer;
    if (!referer) {
      if (request.headers.cookie) {
        throw new ForbiddenException('Request origin is not allowed');
      }
      return;
    }

    try {
      if (!isAllowedFrontendOrigin(this.configService, new URL(referer).origin)) {
        throw new ForbiddenException('Request origin is not allowed');
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ForbiddenException('Request origin is not allowed');
    }
  }

  private getBearerToken(header: string | undefined): string | undefined {
    const match = header?.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || undefined;
  }

  private buildFullName(parts: (string | undefined)[]) {
    return parts
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ');
  }
}
