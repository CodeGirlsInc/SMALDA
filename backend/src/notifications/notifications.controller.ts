import { Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @Query() query: ListNotificationsDto,
    @Req() req: Request & { user?: User },
  ) {
    return this.notificationsService.findForUser(
      req.user!.id,
      query.limit,
      query.unread,
    );
  }

  @Get('unread-count')
  unreadCount(@Req() req: Request & { user?: User }) {
    return this.notificationsService.countUnread(req.user!.id);
  }

  @Patch('read-all')
  markAllRead(@Req() req: Request & { user?: User }) {
    return this.notificationsService.markAllRead(req.user!.id);
  }

  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @Req() req: Request & { user?: User },
  ) {
    return this.notificationsService.markRead(req.user!.id, id);
  }
}
