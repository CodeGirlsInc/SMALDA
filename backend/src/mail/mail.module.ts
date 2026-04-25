import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { NotificationPrefsModule } from '../../cmmty/notification-prefs/notification-prefs.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ConfigModule, NotificationPrefsModule, UsersModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
