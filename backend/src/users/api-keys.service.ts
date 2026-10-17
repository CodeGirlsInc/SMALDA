import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';

import { ApiKey } from './entities/api-key.entity';
import { User } from './entities/user.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UsersService } from './users.service';

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
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

  list(userId: string): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
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

  async validateKey(secret: string): Promise<User | null> {
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

    return this.usersService.findById(apiKey.userId);
  }
}
