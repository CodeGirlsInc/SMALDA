import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationPrefsService } from './notification-prefs.service';
import { NotificationPrefsController } from './notification-prefs.controller';
import { NotificationPrefs } from './notification-prefs.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationPrefs])],
  controllers: [NotificationPrefsController],
  providers: [NotificationPrefsService],
  exports: [NotificationPrefsService],
})
export class NotificationPrefsModule {}
