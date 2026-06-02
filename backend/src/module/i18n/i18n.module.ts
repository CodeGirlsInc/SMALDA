import { Module } from '@nestjs/common';
import { I18nModule as NestI18nModule } from 'nestjs-i18n';
import { AcceptLanguageResolver, I18nJsonLoader } from 'nestjs-i18n';
import { join } from 'path';

import { MultiLanguageSupportService } from './multi-language-support.service';

@Module({
  imports: [
    NestI18nModule.forRoot({
      fallbackLanguage: 'en',
      loader: I18nJsonLoader,
      loaderOptions: {
        path: join(__dirname, 'locales'),
        watch: true,
      },
      resolvers: [new AcceptLanguageResolver({ matchType: 'strict-loose' })],
      logging: false,
    }),
  ],
  providers: [MultiLanguageSupportService],
  exports: [MultiLanguageSupportService],
})
export class I18nModule {}
