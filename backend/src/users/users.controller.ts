import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, User } from './entities/user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@Req() req: Request & { user?: User }): UserResponseDto {
    return UserResponseDto.from(req.user!);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile' })
  async updateMe(
    @Req() req: Request & { user?: User },
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const updated = await this.usersService.update(req.user!.id, dto);
    return UserResponseDto.from(updated!);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Soft-delete own account' })
  async deleteMe(@Req() req: Request & { user?: User }): Promise<{ message: string }> {
    await this.usersService.softDelete(req.user!.id);
    return { message: 'Account deleted' };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all users (admin only)' })
  async listAll(@Query() pagination: PaginationDto) {
    const result = await this.usersService.findAll(pagination.page ?? 1, pagination.limit ?? 20);
    return { ...result, data: result.data.map(UserResponseDto.from) };
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user by ID (admin only)' })
  async getById(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return UserResponseDto.from(user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete user by ID (admin only)' })
  async deleteById(@Param('id') id: string): Promise<{ message: string }> {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    await this.usersService.softDelete(id);
    return { message: 'User deleted' };
  }
}
