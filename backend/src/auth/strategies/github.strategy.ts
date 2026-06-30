import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly configService: ConfigService) {
    const clientID = configService.get<string>('GITHUB_CLIENT_ID');
    const clientSecret = configService.get<string>('GITHUB_CLIENT_SECRET');

    if (!clientID || !clientSecret) {
      throw new Error('GitHub OAuth client credentials are not configured');
    }

    const appUrl = (configService.get<string>('APP_URL') || 'http://localhost:6004').replace(/\/+$/, '');
    const callbackURL =
      configService.get<string>('GITHUB_CALLBACK_URL') ??
      `${appUrl}/api/auth/github/callback`;

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    return profile;
  }
}
