import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ActivityTrackerService } from './activity-tracker.service';
import { FilterActivityDto } from './dto/filter-activity.dto';

@Controller('admin/activity')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ActivityTrackerController {
  constructor(private readonly activityTracker: ActivityTrackerService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(@Query() filter: FilterActivityDto) {
    const { page = 1, limit = 20 } = filter;
    const { data, total } = await this.activityTracker.findActivities(filter);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
