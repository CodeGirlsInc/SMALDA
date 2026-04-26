import { Controller, Get, Patch, Req, UseGuards, Body } from '@nestjs/common';
import { NotificationPrefsService } from './notification-prefs.service';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { User } from '../../src/users/entities/user.entity';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@Controller('users')
export class NotificationPrefsController {
  constructor(
    private readonly notificationPrefsService: NotificationPrefsService,
  ) {}

  @Get('me/notification-preferences')
  @UseGuards(JwtAuthGuard)
  async getNotificationPreferences(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.notificationPrefsService.getPreferences(userId);
  }

  @Patch('me/notification-preferences')
  @UseGuards(JwtAuthGuard)
  async updateNotificationPreferences(
    @Req() req: AuthenticatedRequest,
    @Body() updateDto: UpdateNotificationPrefsDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.notificationPrefsService.updatePreferences(userId, updateDto);
  }
}
