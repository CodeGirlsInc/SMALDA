import { Controller, Get, Patch, Delete, Param, Body, Query, Req, UseGuards, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User, UserRole } from '../../users/entities/user.entity';

@Controller('module/admin/users')
@UseGuards(JwtAuthGuard)
export class AdminUserManagementController {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  private guard(req: { user: User }) { if (req.user.role !== UserRole.ADMIN) throw new ForbiddenException(); }

  @Get()
  list(@Req() req: { user: User }, @Query('page') page = '1', @Query('limit') limit = '20', @Query('includeDeleted') includeDeleted?: string) {
    this.guard(req);
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, parseInt(limit, 10));
    return this.users.findAndCount({ withDeleted: includeDeleted === 'true', skip: (p - 1) * l, take: l });
  }

  @Get(':id')
  getOne(@Req() req: { user: User }, @Param('id') id: string) {
    this.guard(req);
    return this.users.findOneByOrFail({ id });
  }

  @Patch(':id/role')
  async updateRole(@Req() req: { user: User }, @Param('id') id: string, @Body() body: { role: UserRole }) {
    this.guard(req);
    await this.users.update(id, { role: body.role });
    return this.users.findOneByOrFail({ id });
  }

  @Delete(':id')
  async softDelete(@Req() req: { user: User }, @Param('id') id: string) {
    this.guard(req);
    if (req.user.id === id) throw new UnprocessableEntityException('Cannot delete your own account');
    await this.users.softDelete(id);
    return { message: 'User soft-deleted' };
  }
}