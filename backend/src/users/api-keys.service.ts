import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';

import { ApiKey, ApiKeyScope } from './entities/api-key.entity';
import { User } from './entities/user.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKeyResponseDto } from './dto/api-key-response.dto';
import { UsersService } from './users.service';

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export interface ValidatedApiKey {
  user: User;
  scopes: ApiKeyScope[];
}

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    private readonly usersService: UsersService,
  ) {}

  async create(userId: string, dto: CreateApiKeyDto) {
    const secret = `smalda_${randomBytes(24).toString('hex')}`;
    const apiKey = await this.apiKeyRepository.save(
      this.apiKeyRepository.create({
        userId,
        name: dto.name,
        prefix: secret.slice(0, 14),
        keyHash: hashSecret(secret),
        scopes: dto.scopes ?? [],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      }),
    );

    // The plain-text secret is returned exactly once and never stored.
    return {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      key: secret,
    };
  }

  async list(userId: string): Promise<ApiKeyResponseDto[]> {
    const keys = await this.apiKeyRepository.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    // Never expose the stored key hash (or the owner id) to the browser.
    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      scopes: key.scopes,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    }));
  }

  async revoke(userId: string, id: string): Promise<{ message: string }> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id, userId },
    });
    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    if (!apiKey.revokedAt) {
      apiKey.revokedAt = new Date();
      await this.apiKeyRepository.save(apiKey);
    }

    return { message: 'API key revoked' };
  }

  async validateKey(secret: string): Promise<ValidatedApiKey | null> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { keyHash: hashSecret(secret) },
    });
    if (!apiKey || apiKey.revokedAt) {
      return null;
    }
    if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    apiKey.lastUsedAt = new Date();
    await this.apiKeyRepository.save(apiKey);

    const user = await this.usersService.findById(apiKey.userId);
    if (!user) {
      return null;
    }

    return { user, scopes: apiKey.scopes ?? [] };
  }
}
