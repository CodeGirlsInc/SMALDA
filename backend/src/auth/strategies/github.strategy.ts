import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID'),
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GITHUB_CALLBACK_URL'),
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: Function,
  ): Promise<any> {
    const { id, username, emails, photos } = profile;
    const user = {
      providerId: id,
      email: emails?.[0]?.value || `${username}@github.com`,
      firstName: profile.displayName?.split(' ')[0] || username,
      lastName: profile.displayName?.split(' ')[1] || '',
      avatar: photos?.[0]?.value || profile.avatar_url,
      provider: 'github',
    };
    done(null, user);
  }
}
