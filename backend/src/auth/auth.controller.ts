import {
  Body,
  Controller,
  Post,
  Get,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Profile as GoogleProfile } from 'passport-google-oauth20';
import { Profile as GithubProfile } from 'passport-github2';

import { AuthService } from './auth.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RefreshAuthDto } from './dto/refresh-auth.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { EnableTwoFactorDto, DisableTwoFactorDto, VerifyTwoFactorDto } from './dto/two-factor.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  register(@Body() dto: RegisterAuthDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Returns access and refresh tokens' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginAuthDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token with rotation' })
  @ApiResponse({ status: 200, description: 'Returns new access and refresh tokens' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  refresh(@Body() dto: RefreshAuthDto) {
    return this.authService.refreshTokenWithRotation(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Logout and revoke refresh tokens' })
  @ApiResponse({ status: 200, description: 'Tokens revoked successfully' })
  logout(@Req() req: Request & { user?: User }, @Body() body: { refreshToken?: string; revokeAll?: boolean }) {
    const userId = req.user!.id;
    return this.authService.logout(userId, body.refreshToken || '', body.revokeAll);
  }

  // ==================== PASSWORD RESET ====================
  @Post('forgot-password')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'Password reset email sent if email exists' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ==================== EMAIL VERIFICATION ====================
  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  verifyEmail(@Query() query: VerifyEmailDto) {
    return this.authService.verifyEmail(query.token);
  }

  @Post('resend-verification')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  resendVerification(@Req() req: Request & { user?: User }) {
    return this.authService.resendVerificationEmail(req.user!.id);
  }

  // ==================== TWO-FACTOR AUTHENTICATION ====================
  @Post('2fa/generate')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Generate TOTP secret and QR code URI' })
  @ApiResponse({ status: 200, description: 'Returns TOTP secret and otpauth URL' })
  generateTwoFactor(@Req() req: Request & { user?: User }) {
    return this.authService.generateTwoFactorSecret(req.user!.id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Enable 2FA with TOTP code' })
  @ApiResponse({ status: 200, description: '2FA enabled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid TOTP code' })
  enableTwoFactor(@Req() req: Request & { user?: User }, @Body() dto: EnableTwoFactorDto) {
    return this.authService.enableTwoFactor(req.user!.id, dto);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Disable 2FA with TOTP code' })
  @ApiResponse({ status: 200, description: '2FA disabled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid TOTP code' })
  disableTwoFactor(@Req() req: Request & { user?: User }, @Body() dto: DisableTwoFactorDto) {
    return this.authService.disableTwoFactor(req.user!.id, dto);
  }

  @Post('2fa/verify')
  @ApiOperation({ summary: 'Verify 2FA code during login' })
  @ApiResponse({ status: 200, description: 'Returns access and refresh tokens' })
  @ApiResponse({ status: 401, description: 'Invalid 2FA code' })
  verifyTwoFactor(@Body() dto: VerifyTwoFactorDto & { userId: string }) {
    return this.authService.loginWithTwoFactor(dto.userId, dto.code);
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
    const identifier = email || (githubId ? `github_${githubId}@github.placeholder` : null);
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
