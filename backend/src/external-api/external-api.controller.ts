import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiKeyAuth } from 'src/api-key/decorators/api-key.decorator';
import { GetUser } from 'src/auth/decorators/getUser.decorator';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/providers/users.service';
import { UserRole } from 'src/auth/enums/roles.enum';

@Controller('api/v1/external')
@ApiKeyAuth() // Apply to entire controller
export class ExternalApiController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  async getProfile(@GetUser() user: User) {
    return {
      success: true,
      data: await this.usersService.userProfile(user),
      message: 'Profile accessed via API key',
    };
  }

  @Get('users')
  @HttpCode(HttpStatus.OK)
  async getAllUsers(@GetUser() user: User) {
    // You can still check user permissions even with API key auth
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    return {
      success: true,
      data: await this.usersService.getAllUsers(),
      message: 'Users accessed via API key',
    };
  }

  @Post('webhook-data')
  @HttpCode(HttpStatus.OK)
  async receiveWebhookData(@GetUser() user: User, @Body() webhookData: any) {
    // Process the webhook data
    console.log('Webhook data received:', webhookData);

    return {
      success: true,
      message: 'Webhook data received',
      receivedBy: user.email,
      timestamp: new Date(),
      dataReceived: !!webhookData,
    };
  }

  @Get('protected-data')
  @HttpCode(HttpStatus.OK)
  async getProtectedData(@GetUser() user: User) {
    return {
      data: 'This requires an API key!',
      accessedBy: user.email,
      timestamp: new Date(),
    };
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  async getStatus(@GetUser() user: User) {
    return {
      status: 'active',
      version: '1.0',
      user: user.email,
      timestamp: new Date(),
      uptime: process.uptime(),
    };
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  async getHealth() {
    return {
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date(),
    };
  }
}
