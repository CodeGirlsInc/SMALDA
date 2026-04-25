import { Controller, Get, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { AnalyticsService, AnalyticsData } from './analytics.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { User } from '../../src/users/entities/user.entity';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  async getAnalytics(
    @Req() req: AuthenticatedRequest,
    @Query('period') period: '7d' | '30d' | '90d' = '30d',
  ): Promise<AnalyticsData> {
    if (req.user?.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    if (!['7d', '30d', '90d'].includes(period)) {
      throw new Error('Invalid period. Must be one of: 7d, 30d, 90d');
    }

    return this.analyticsService.getAnalytics(period);
  }
}
