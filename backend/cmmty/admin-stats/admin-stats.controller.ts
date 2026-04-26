import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { AdminStatsService } from './admin-stats.service';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { UserRole } from '../../src/users/entities/user.entity';
import { AdminStatsDto } from './dto/admin-stats.dto';

@Controller('cmmty/admin')
export class AdminStatsController {
  constructor(private readonly adminStatsService: AdminStatsService) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getStats(): Promise<AdminStatsDto> {
    return this.adminStatsService.getPlatformStats();
  }
}
