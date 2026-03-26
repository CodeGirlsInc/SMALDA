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
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { Profile } from 'passport-google-oauth20';

import { AuthService } from './auth.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RefreshAuthDto } from './dto/refresh-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterAuthDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginAuthDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshAuthDto) {
    return this.authService.refreshToken(dto);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    return;
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(
    @Req() req: Request & { user?: Profile },
    @Res() res: Response,
  ) {
    const profile = req.user;
    const email = profile?.emails?.[0]?.value;
    if (!email) {
      throw new BadRequestException(
        'Google profile did not contain an email address',
      );
    }

    const nameParts = [
      profile?.displayName,
      profile?.name?.givenName,
      profile?.name?.familyName,
    ]
      .filter(Boolean)
      .map((part) => part?.trim())
      .filter(Boolean);
    const fullName = nameParts.join(' ');

    const { access_token } = await this.authService.handleOAuthLogin(
      email,
      fullName || email,
    );
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const redirectUrl = new URL(frontendUrl);
    redirectUrl.searchParams.set('token', access_token);

    return res.redirect(redirectUrl.toString());
  }
}
