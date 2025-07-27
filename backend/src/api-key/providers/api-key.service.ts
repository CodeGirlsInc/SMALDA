import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  RequestTimeoutException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ApiKey, ApiKeyStatus } from '../entities/api-key.entity';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  RevokeApiKeyDto,
  ApiKeyResponseDto,
} from '../dto/api-key.dto';
import { User } from 'src/users/entities/user.entity';
import { HashingProvider } from 'src/auth/providers/hashing.provider';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    private readonly hashingProvider: HashingProvider,
  ) {}

  /**
   * Generate a new API key for a user
   */
  async createApiKey(
    user: User,
    createApiKeyDto: CreateApiKeyDto,
  ): Promise<ApiKeyResponseDto> {
    // Check if user already has maximum number of API keys (e.g., 10)
    const existingKeysCount = await this.apiKeyRepository.count({
      where: { userId: user.id, status: ApiKeyStatus.ACTIVE },
    });

    if (existingKeysCount >= 10) {
      throw new BadRequestException('Maximum number of API keys reached (10)');
    }

    // Generate the API key
    const apiKeyString = this.generateApiKey();
    const prefix = apiKeyString.substring(0, 8);

    // Hash the API key for storage
    const keyHash = await this.hashingProvider.hash(apiKeyString);

    const apiKey = this.apiKeyRepository.create({
      keyHash,
      name: createApiKeyDto.name,
      description: createApiKeyDto.description,
      prefix,
      userId: user.id,
      user,
      expiresAt: createApiKeyDto.expiresAt
        ? new Date(createApiKeyDto.expiresAt)
        : null,
    });

    try {
      const savedApiKey = await this.apiKeyRepository.save(apiKey);

      return {
        apiKey: apiKeyString, // Only returned on creation
        prefix: savedApiKey.prefix,
        name: savedApiKey.name,
        description: savedApiKey.description,
        status: savedApiKey.status,
        expiresAt: savedApiKey.expiresAt,
        lastUsedAt: savedApiKey.lastUsedAt,
        usageCount: savedApiKey.usageCount,
        createdAt: savedApiKey.createdAt,
      };
    } catch (error) {
      console.error('Failed to create API key:', error);
      throw new InternalServerErrorException('Failed to create API key');
    }
  }

  /**
   * Get all API keys for a user
   */
  async getUserApiKeys(userId: string): Promise<ApiKeyResponseDto[]> {
    try {
      const apiKeys = await this.apiKeyRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      });

      return apiKeys.map((key) => ({
        prefix: key.prefix,
        name: key.name,
        description: key.description,
        status: key.status,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        usageCount: key.usageCount,
        createdAt: key.createdAt,
      }));
    } catch (error) {
      console.error('Error fetching API keys:', error);
      throw new RequestTimeoutException('Error fetching API keys');
    }
  }

  /**
   * Get a specific API key by ID
   */
  async getApiKeyById(
    userId: string,
    keyId: string,
  ): Promise<ApiKeyResponseDto> {
    const apiKey = await this.findApiKeyByIdAndUser(keyId, userId);

    return {
      prefix: apiKey.prefix,
      name: apiKey.name,
      description: apiKey.description,
      status: apiKey.status,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      usageCount: apiKey.usageCount,
      createdAt: apiKey.createdAt,
    };
  }

  /**
   * Update an API key
   */
  async updateApiKey(
    userId: string,
    keyId: string,
    updateApiKeyDto: UpdateApiKeyDto,
  ): Promise<ApiKeyResponseDto> {
    const apiKey = await this.findApiKeyByIdAndUser(keyId, userId);

    if (apiKey.status === ApiKeyStatus.REVOKED) {
      throw new BadRequestException('Cannot update a revoked API key');
    }

    // Update fields
    if (updateApiKeyDto.name) apiKey.name = updateApiKeyDto.name;
    if (updateApiKeyDto.description !== undefined)
      apiKey.description = updateApiKeyDto.description;
    if (updateApiKeyDto.expiresAt)
      apiKey.expiresAt = new Date(updateApiKeyDto.expiresAt);

    try {
      const updatedKey = await this.apiKeyRepository.save(apiKey);

      return {
        prefix: updatedKey.prefix,
        name: updatedKey.name,
        description: updatedKey.description,
        status: updatedKey.status,
        expiresAt: updatedKey.expiresAt,
        lastUsedAt: updatedKey.lastUsedAt,
        usageCount: updatedKey.usageCount,
        createdAt: updatedKey.createdAt,
      };
    } catch (error) {
      console.error('Failed to update API key:', error);
      throw new InternalServerErrorException('Failed to update API key');
    }
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(
    userId: string,
    keyId: string,
    revokeApiKeyDto: RevokeApiKeyDto,
  ): Promise<{ success: boolean; message: string }> {
    const apiKey = await this.findApiKeyByIdAndUser(keyId, userId);

    if (apiKey.status === ApiKeyStatus.REVOKED) {
      throw new BadRequestException('API key is already revoked');
    }

    apiKey.status = ApiKeyStatus.REVOKED;
    apiKey.revokedAt = new Date();
    apiKey.revokedReason = revokeApiKeyDto.reason;

    try {
      await this.apiKeyRepository.save(apiKey);
      return {
        success: true,
        message: 'API key revoked successfully',
      };
    } catch (error) {
      console.error('Failed to revoke API key:', error);
      throw new InternalServerErrorException('Failed to revoke API key');
    }
  }

  /**
   * Delete an API key permanently
   */
  async deleteApiKey(
    userId: string,
    keyId: string,
  ): Promise<{ success: boolean; message: string }> {
    const apiKey = await this.findApiKeyByIdAndUser(keyId, userId);

    try {
      await this.apiKeyRepository.remove(apiKey);
      return {
        success: true,
        message: 'API key deleted successfully',
      };
    } catch (error) {
      console.error('Failed to delete API key:', error);
      throw new InternalServerErrorException('Failed to delete API key');
    }
  }

  /**
   * Validate an API key and return the associated user
   */
  async validateApiKey(apiKeyString: string): Promise<User | null> {
    if (!apiKeyString || !apiKeyString.startsWith('sk_')) {
      return null;
    }

    const prefix = apiKeyString.substring(0, 8);

    try {
      const apiKeys = await this.apiKeyRepository.find({
        where: { prefix, status: ApiKeyStatus.ACTIVE },
        relations: ['user'],
      });

      for (const apiKey of apiKeys) {
        // Check if key has expired
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
          // Mark as expired
          apiKey.status = ApiKeyStatus.EXPIRED;
          await this.apiKeyRepository.save(apiKey);
          continue;
        }

        // Compare the provided key with the stored hash
        const isValid = await this.hashingProvider.compare(
          apiKeyString,
          apiKey.keyHash,
        );

        if (isValid) {
          // Update usage statistics
          apiKey.lastUsedAt = new Date();
          apiKey.usageCount += 1;
          await this.apiKeyRepository.save(apiKey);

          return apiKey.user;
        }
      }

      return null;
    } catch (error) {
      console.error('Error validating API key:', error);
      return null;
    }
  }

  /**
   * Clean up expired API keys (run periodically)
   */
  async cleanupExpiredKeys(): Promise<number> {
    const now = new Date();

    try {
      const result = await this.apiKeyRepository.update(
        {
          expiresAt: LessThan(now),
          status: ApiKeyStatus.ACTIVE,
        },
        { status: ApiKeyStatus.EXPIRED },
      );

      return result.affected || 0;
    } catch (error) {
      console.error('Failed to cleanup expired keys:', error);
      throw new InternalServerErrorException('Failed to cleanup expired keys');
    }
  }

  /**
   * Helper method to find API key by ID and user
   */
  private async findApiKeyByIdAndUser(
    keyId: string,
    userId: string,
  ): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id: keyId, userId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    return apiKey;
  }

  /**
   * Generate a secure API key
   */
  private generateApiKey(): string {
    const randomBytes = crypto.randomBytes(32);
    const base64String = randomBytes.toString('base64').replace(/[+/=]/g, '');
    return `sk_live_${base64String.substring(0, 40)}`;
  }
}
