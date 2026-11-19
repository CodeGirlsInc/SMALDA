import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { REQUIRE_SCOPES_KEY } from '../decorators/require-scopes.decorator';
import { ApiKeyScope } from '../entities/api-key.entity';
import { ApiKeysService } from './api-keys.service';
import { User } from './entities/user.entity';

/**
 * Authenticates a request with an `x-api-key` header, falling back to the
 * normal JWT flow when no key is supplied. Route handlers can therefore opt
 * into API-key access without losing cookie/bearer authentication.
 *
 * Routes decorated with `@RequireScopes(...)` additionally verify that the
 * presented key was granted every required scope. JWT sessions are not
 * scope-limited; the check applies only to API-key authentication.
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly jwtAuthGuard: JwtAuthGuard,
    private readonly reflector: Reflector,
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

    const validated = await this.apiKeysService.validateKey(key);
    if (!validated) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    const requiredScopes = this.reflector.getAllAndOverride<ApiKeyScope[]>(
      REQUIRE_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredScopes?.length) {
      const granted = new Set(validated.scopes);
      const missing = requiredScopes.filter((scope) => !granted.has(scope));
      if (missing.length) {
        throw new ForbiddenException(
          `API key is missing required scope(s): ${missing.join(', ')}`,
        );
      }
    }

    request.user = validated.user;
    return true;
  }
}
