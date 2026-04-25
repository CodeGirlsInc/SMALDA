import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../../src/documents/entities/document.entity';
import { MailModule } from '../../src/mail/mail.module';
import { ExpiryNotificationLog } from './expiry-notification-log.entity';
import { ExpiryNotifierService } from './expiry-notifier.service';

@Module({
  imports: [TypeOrmModule.forFeature([Document, ExpiryNotificationLog]), MailModule],
  providers: [ExpiryNotifierService],
  exports: [ExpiryNotifierService],
})
export class ExpiryNotifierModule {}
