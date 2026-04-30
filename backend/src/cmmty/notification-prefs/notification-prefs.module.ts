import { Module } from '@nestjs/common';
import { NotificationPrefsService } from './notification-prefs.service';

@Module({
  providers: [NotificationPrefsService],
  exports: [NotificationPrefsService],
})
export class NotificationPrefsModule {}
