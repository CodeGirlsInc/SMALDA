import {
  Body,
  Controller,
  Post,
  Get,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { Profile as GoogleProfile } from 'passport-google-oauth20';
import { Profile as GithubProfile } from 'passport-github2';

import { AuthService } from './auth.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RefreshAuthDto } from './dto/refresh-auth.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  register(@Body() dto: RegisterAuthDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Returns access and refresh tokens' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginAuthDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Returns a new access token' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  refresh(@Body() dto: RefreshAuthDto) {
    return this.authService.refreshToken(dto);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Google login' })
  googleAuth() {
    return;
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with token' })
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

    const { access_token } = await this.authService.handleOAuthLogin(
      email,
      fullName || email,
    );

    return this.redirectWithToken(access_token, res);
  }

  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Initiate GitHub OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to GitHub login' })
  githubAuth() {
    return;
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with token' })
  async githubAuthRedirect(
    @Req() req: Request & { user?: GithubProfile },
    @Res() res: Response,
  ) {
    const profile = req.user;
    const githubId = profile?.id?.toString();
    const email = profile?.emails?.[0]?.value;
    const identifier = email || (githubId ? githubId : null);
    if (!identifier) {
      throw new BadRequestException('GitHub profile could not be identified');
    }

    const fullName =
      this.buildFullName([profile?.displayName, profile?.username]) ||
      identifier;

    const { access_token } = await this.authService.handleOAuthLogin(
      identifier,
      fullName,
    );

    return this.redirectWithToken(access_token, res);
  }

  private redirectWithToken(accessToken: string, res: Response) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const redirectUrl = new URL(frontendUrl);
    redirectUrl.searchParams.set('token', accessToken);
    return res.redirect(redirectUrl.toString());
  }

  private buildFullName(parts: (string | undefined)[]) {
    return parts
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ');
  }
}
