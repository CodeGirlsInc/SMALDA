import { enTranslations } from './en';
import { frTranslations } from './fr';

export type TranslationType = typeof enTranslations;

export const translations: Record<string, TranslationType> = {
  en: enTranslations,
  fr: frTranslations,
};

export const DEFAULT_LANGUAGE = 'en';
export const SUPPORTED_LANGUAGES = ['en', 'fr'];

export function getTranslations(language?: string): TranslationType {
  if (!language || !SUPPORTED_LANGUAGES.includes(language)) {
    return translations[DEFAULT_LANGUAGE];
  }
  return translations[language];
}
