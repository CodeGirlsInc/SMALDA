import { Injectable, OnModuleInit } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

type LocaleData = Record<string, unknown>;

@Injectable()
export class MultiLanguageSupportService implements OnModuleInit {
  private readonly localesPath = join(__dirname, 'locales');
  private supportedLanguages: string[] = ['en'];

  constructor(private readonly i18nService: I18nService) {}

  async onModuleInit() {
    await this.validateLocaleFiles();
  }

  translate(key: string, lang: string) {
    return this.i18nService.translate(key, { lang });
  }

  isSupported(languageCode: string) {
    return this.supportedLanguages.includes(languageCode);
  }

  getSupportedLanguages() {
    return [...this.supportedLanguages];
  }

  private async validateLocaleFiles() {
    const entries = await readdir(this.localesPath, { withFileTypes: true });
    const localeDirs = entries.filter((entry) => entry.isDirectory());

    this.supportedLanguages = localeDirs.map((entry) => entry.name);

    if (!this.supportedLanguages.includes('en')) {
      throw new Error('English locale is required');
    }

    const english = await this.loadLocale('en');

    for (const languageCode of this.supportedLanguages) {
      const locale = await this.loadLocale(languageCode);
      const missingKeys = this.findMissingKeys(english, locale);
      if (missingKeys.length > 0) {
        throw new Error(
          `Locale ${languageCode} is missing keys: ${missingKeys.join(', ')}`,
        );
      }
    }
  }

  private async loadLocale(languageCode: string): Promise<LocaleData> {
    const filePath = join(
      this.localesPath,
      languageCode,
      `${languageCode}.json`,
    );
    const raw = await readFile(filePath, 'utf8');

    try {
      return JSON.parse(raw) as LocaleData;
    } catch {
      throw new Error(`Invalid JSON in locale file ${filePath}`);
    }
  }

  private findMissingKeys(
    source: LocaleData,
    target: LocaleData,
    prefix = '',
  ): string[] {
    const missing: string[] = [];

    for (const [key, value] of Object.entries(source)) {
      const currentKey = prefix ? `${prefix}.${key}` : key;
      const targetValue = target[key];

      if (targetValue === undefined) {
        missing.push(currentKey);
        continue;
      }

      if (this.isPlainObject(value) && this.isPlainObject(targetValue)) {
        missing.push(...this.findMissingKeys(value, targetValue, currentKey));
      }
    }

    return missing;
  }

  private isPlainObject(value: unknown): value is LocaleData {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }
}
