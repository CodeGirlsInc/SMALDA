import { SetMetadata } from '@nestjs/common';
import { ApiKeyScope } from '../entities/api-key.entity';

export const REQUIRE_SCOPES_KEY = 'apiKeyScopes';

export const RequireScopes = (...scopes: ApiKeyScope[]) =>
  SetMetadata(REQUIRE_SCOPES_KEY, scopes);
