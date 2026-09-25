import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';
import { ACCESS_COOKIE_NAME, getCookieValue } from '../auth-cookie';

const accessTokenExtractor = ExtractJwt.fromExtractors([
  ExtractJwt.fromAuthHeaderAsBearerToken(),
  (request: Request) =>
    getCookieValue(request.headers.cookie, ACCESS_COOKIE_NAME),
]);

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: accessTokenExtractor,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(request: any, payload?: JwtPayload) {
    const tokenRequest = payload ? request : undefined;
    const tokenPayload = payload ?? (request as JwtPayload);
    const token =
      tokenRequest && tokenRequest.headers
        ? (accessTokenExtractor(tokenRequest as Request) as string | null)
        : null;

    if (token && this.authService.isTokenBlacklisted(token)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.usersService.findById(tokenPayload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
