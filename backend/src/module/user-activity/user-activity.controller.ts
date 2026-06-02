import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User } from '../../users/entities/user.entity';
import { UserActivityDashboardService } from './user-activity-dashboard.service';

@Controller('module/users')
@UseGuards(JwtAuthGuard)
export class UserActivityController {
  constructor(
    private readonly userActivityDashboardService: UserActivityDashboardService,
  ) {}

  @Get('me/activity')
  async getMyActivity(
    @Req() req: { user: User },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (startDate !== undefined && !startDate.trim()) {
      throw new BadRequestException('startDate cannot be empty');
    }

    if (endDate !== undefined && !endDate.trim()) {
      throw new BadRequestException('endDate cannot be empty');
    }

    if (startDate && Number.isNaN(new Date(startDate).getTime())) {
      throw new BadRequestException('startDate must be a valid date');
    }

    if (endDate && Number.isNaN(new Date(endDate).getTime())) {
      throw new BadRequestException('endDate must be a valid date');
    }

    return this.userActivityDashboardService.findRecentActivity(
      req.user.id,
      startDate,
      endDate,
    );
  }
}
