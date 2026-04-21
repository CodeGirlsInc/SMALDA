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

    super({
      clientID,
      clientSecret,
      callbackURL:
        configService.get<string>('GITHUB_CALLBACK_URL') ||
        ${configService.get<string>('APP_URL') || 'http://localhost:6004'}/api/auth/github/callback,
      scope: ['user:email'],
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: Profile) {
    return profile;
  }
}
