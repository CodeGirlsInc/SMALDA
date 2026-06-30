import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  private readonly logger = new Logger(GithubStrategy.name);

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
    accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    if ((!profile.emails || profile.emails.length === 0) && accessToken) {
      try {
        const res = await fetch('https://api.github.com/user/emails', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const emails: Array<{ email: string; primary: boolean }> = await res.json();
          profile.emails = emails.map((e) => ({ value: e.email }));
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch GitHub emails: ${(err as Error).message}`);
      }
    }
    return profile;
  }
}
