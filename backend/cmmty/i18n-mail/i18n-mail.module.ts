import { Module } from '@nestjs/common';
import { I18nMailService } from './i18n-mail.service';

@Module({
  providers: [I18nMailService],
  exports: [I18nMailService],
})
export class I18nMailModule {}
