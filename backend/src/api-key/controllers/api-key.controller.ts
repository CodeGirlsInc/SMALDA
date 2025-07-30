import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiKeyService } from '../providers/api-key.service';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  RevokeApiKeyDto,
  ApiKeyResponseDto,
} from '../dto/api-key.dto';
import { GetUser } from 'src/auth/decorators/getUser.decorator';
import { User } from 'src/users/entities/user.entity';

@Controller('api/v1/api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createApiKey(
    @GetUser() user: User,
    @Body() createApiKeyDto: CreateApiKeyDto,
  ): Promise<ApiKeyResponseDto> {
    return await this.apiKeyService.createApiKey(user, createApiKeyDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getUserApiKeys(@GetUser() user: User): Promise<ApiKeyResponseDto[]> {
    return await this.apiKeyService.getUserApiKeys(user.id);
  }

  @Get(':keyId')
  @HttpCode(HttpStatus.OK)
  async getApiKeyById(
    @GetUser() user: User,
    @Param('keyId') keyId: string,
  ): Promise<ApiKeyResponseDto> {
    return await this.apiKeyService.getApiKeyById(user.id, keyId);
  }

  @Put(':keyId')
  @HttpCode(HttpStatus.OK)
  async updateApiKey(
    @GetUser() user: User,
    @Param('keyId') keyId: string,
    @Body() updateApiKeyDto: UpdateApiKeyDto,
  ): Promise<ApiKeyResponseDto> {
    return await this.apiKeyService.updateApiKey(
      user.id,
      keyId,
      updateApiKeyDto,
    );
  }

  @Post(':keyId/revoke')
  @HttpCode(HttpStatus.OK)
  async revokeApiKey(
    @GetUser() user: User,
    @Param('keyId') keyId: string,
    @Body() revokeApiKeyDto: RevokeApiKeyDto,
  ): Promise<{ success: boolean; message: string }> {
    return await this.apiKeyService.revokeApiKey(
      user.id,
      keyId,
      revokeApiKeyDto,
    );
  }

  @Delete(':keyId')
  @HttpCode(HttpStatus.OK)
  async deleteApiKey(
    @GetUser() user: User,
    @Param('keyId') keyId: string,
  ): Promise<{ success: boolean; message: string }> {
    return await this.apiKeyService.deleteApiKey(user.id, keyId);
  }
}
