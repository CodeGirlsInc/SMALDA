import { Controller, Get, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { UserActivityService } from './user-activity.service';

@Controller('cmmty/users/me/activity')
@UseGuards(JwtAuthGuard)
export class UserActivityController {
  constructor(private readonly userActivityService: UserActivityService) {}

  @Get()
  getMyActivity(@Req() req: any, @Query() dto: ActivityQueryDto) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not found in request');
    }

    return this.userActivityService.getMyActivity(userId, dto);
  }
}
