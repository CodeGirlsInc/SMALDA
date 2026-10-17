import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { ApiKeysService } from './api-keys.service';
import { DocumentsService } from '../documents/documents.service';
import { AccessLogsService } from '../access-logs/access-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { User, UserRole } from './entities/user.entity';
import { ListUsersDto } from './dto/list-users.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

type AuthedRequest = Request & { user?: User };

function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isVerified: user.isVerified,
    preferredLanguage: user.preferredLanguage,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Self-service data export for GDPR-style portability requests.
 * Returns the caller's own profile and document metadata, with
 * secrets (password hash, 2FA material) and internal file paths
 * excluded from the payload.
 */
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly documentsService: DocumentsService,
    private readonly apiKeysService: ApiKeysService,
    private readonly accessLogsService: AccessLogsService,
  ) {}

  @Get('me/export')
  @UseGuards(ApiKeyAuthGuard)
  async exportMyData(@Req() req: AuthedRequest) {
    const userId = req.user!.id;
    const [user, documents] = await Promise.all([
      this.usersService.findById(userId),
      this.documentsService.findByOwner(userId),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user?.id,
        email: user?.email,
        fullName: user?.fullName,
        role: user?.role,
        isVerified: user?.isVerified,
        preferredLanguage: user?.preferredLanguage,
        twoFactorEnabled: user?.twoFactorEnabled,
        createdAt: user?.createdAt,
        updatedAt: user?.updatedAt,
      },
      documents: (documents ?? []).map((doc) => ({
        id: doc.id,
        title: doc.title,
        status: doc.status,
        riskScore: doc.riskScore,
        riskFlags: doc.riskFlags,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      })),
    };
  }

  @Get('me/api-keys')
  @UseGuards(JwtAuthGuard)
  listApiKeys(@Req() req: AuthedRequest) {
    return this.apiKeysService.list(req.user!.id);
  }

  @Post('me/api-keys')
  @UseGuards(JwtAuthGuard)
  createApiKey(@Req() req: AuthedRequest, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(req.user!.id, dto);
  }

  @Delete('me/api-keys/:id')
  @UseGuards(JwtAuthGuard)
  revokeApiKey(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.apiKeysService.revoke(req.user!.id, id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async listUsers(@Query() query: ListUsersDto) {
    const { page = 1, limit = 20, search, role } = query;
    const result = await this.usersService.findAllPaginated(
      page,
      limit,
      search,
      role,
    );

    return {
      data: result.data.map(toPublicUser),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateUser(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    const target = await this.usersService.findById(id);
    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (target.id === req.user!.id && target.role !== dto.role) {
      throw new BadRequestException('You cannot change your own role');
    }

    if (target.role === UserRole.ADMIN && dto.role !== UserRole.ADMIN) {
      const adminCount = await this.usersService.countAdmins();
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot demote the last admin');
      }
    }

    const updated = await this.usersService.updateRole(id, dto.role);

    await this.accessLogsService.create({
      userId: req.user!.id,
      routePath: `admin/users/${id}/role`,
      httpMethod: 'PATCH',
      ipAddress: req.ip ?? 'unknown',
      statusCode: 200,
    });

    return updated ? toPublicUser(updated) : null;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteUser(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (id === req.user!.id) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const target = await this.usersService.findById(id);
    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (target.role === UserRole.ADMIN) {
      const adminCount = await this.usersService.countAdmins();
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot delete the last admin');
      }
    }

    await this.usersService.softDelete(id);
    return { message: 'User deleted' };
  }
}
