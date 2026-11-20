import { ApiKeyScope } from '../entities/api-key.entity';

export class ApiKeyResponseDto {
  id: string;

  name: string;

  prefix: string;

  scopes: ApiKeyScope[];

  lastUsedAt?: Date | null;

  expiresAt?: Date | null;

  createdAt: Date;
}
