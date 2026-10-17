import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKeysService } from './api-keys.service';
import { User } from './entities/user.entity';

/**
 * Authenticates a request with an `x-api-key` header, falling back to the
 * normal JWT flow when no key is supplied. Route handlers can therefore opt
 * into API-key access without losing cookie/bearer authentication.
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly jwtAuthGuard: JwtAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: User }>();
    const header = request.headers['x-api-key'];
    const key = Array.isArray(header) ? header[0] : header;

    if (!key) {
      return this.jwtAuthGuard.canActivate(context);
    }

    const user = await this.apiKeysService.validateKey(key);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    request.user = user;
    return true;
  }
}
