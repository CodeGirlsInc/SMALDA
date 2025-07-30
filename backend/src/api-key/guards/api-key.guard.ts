import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from '../providers/api-key.service';
import { IS_PUBLIC_KEY } from 'src/auth/decorators/public.decorator';

export const IS_API_KEY_ROUTE = 'isApiKeyRoute';
export const ApiKeyAuth = () => SetMetadata(IS_API_KEY_ROUTE, true);

function SetMetadata(key: string, value: any) {
  return (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    if (descriptor) {
      Reflect.defineMetadata(key, value, descriptor.value);
    } else {
      Reflect.defineMetadata(key, value, target);
    }
  };
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Check if route requires API key authentication
    const requiresApiKey = this.reflector.getAllAndOverride<boolean>(
      IS_API_KEY_ROUTE,
      [context.getHandler(), context.getClass()],
    );

    if (!requiresApiKey) {
      return true; // Let other guards handle authentication
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKeyFromRequest(request);

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const user = await this.apiKeyService.validateApiKey(apiKey);

    if (!user) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Attach user to request object
    request.user = user;
    request.apiKeyAuthenticated = true;

    return true;
  }

  private extractApiKeyFromRequest(request: any): string | null {
    // Check Authorization header: Authorization: Bearer sk_live_...
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token.startsWith('sk_')) {
        return token;
      }
    }

    // Check X-API-Key header
    const apiKeyHeader = request.headers['x-api-key'];
    if (apiKeyHeader && typeof apiKeyHeader === 'string') {
      return apiKeyHeader;
    }

    // Check query parameter
    const apiKeyQuery = request.query.api_key;
    if (apiKeyQuery && typeof apiKeyQuery === 'string') {
      return apiKeyQuery;
    }

    return null;
  }
}
