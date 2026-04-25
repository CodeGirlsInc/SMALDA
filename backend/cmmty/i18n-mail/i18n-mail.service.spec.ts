import { getTranslations, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './locales';
import { enTranslations } from './locales/en';
import { frTranslations } from './locales/fr';

describe('I18n Mail - Language Selection', () => {
  describe('getTranslations', () => {
    it('should return English translations by default', () => {
      const translations = getTranslations();
      expect(translations.welcome.subject).toBe('Welcome to Smalda');
    });

    it('should return English translations when language is undefined', () => {
      const translations = getTranslations(undefined);
      expect(translations.welcome.subject).toBe('Welcome to Smalda');
    });

    it('should return English translations when language is null', () => {
      const translations = getTranslations(null as any);
      expect(translations.welcome.subject).toBe('Welcome to Smalda');
    });

    it('should return English translations for "en"', () => {
      const translations = getTranslations('en');
      expect(translations.welcome.subject).toBe('Welcome to Smalda');
      expect(translations.verificationComplete.subject).toBe('Document Verification Complete');
    });

    it('should return French translations for "fr"', () => {
      const translations = getTranslations('fr');
      expect(translations.welcome.subject).toBe('Bienvenue sur Smalda');
      expect(translations.verificationComplete.subject).toBe('Vérification du document terminée');
    });

    it('should fall back to English for unsupported language', () => {
      const translations = getTranslations('es');
      expect(translations.welcome.subject).toBe('Welcome to Smalda');
    });

    it('should fall back to English for invalid language code', () => {
      const translations = getTranslations('invalid');
      expect(translations.welcome.subject).toBe('Welcome to Smalda');
    });

    it('should handle empty string as default language', () => {
      const translations = getTranslations('');
      expect(translations.welcome.subject).toBe('Welcome to Smalda');
    });
  });

  describe('Translation content', () => {
    it('should have complete English translations', () => {
      const en = getTranslations('en');
      
      expect(en.welcome.subject).toBeDefined();
      expect(en.welcome.greeting).toBeDefined();
      expect(en.welcome.body).toBeDefined();
      
      expect(en.verificationComplete.subject).toBeDefined();
      expect(en.verificationComplete.body).toBeDefined();
      
      expect(en.riskAlert.subject).toBeDefined();
      expect(en.riskAlert.body).toBeDefined();
    });

    it('should have complete French translations', () => {
      const fr = getTranslations('fr');
      
      expect(fr.welcome.subject).toBeDefined();
      expect(fr.welcome.greeting).toBeDefined();
      expect(fr.welcome.body).toBeDefined();
      
      expect(fr.verificationComplete.subject).toBeDefined();
      expect(fr.verificationComplete.body).toBeDefined();
      
      expect(fr.riskAlert.subject).toBeDefined();
      expect(fr.riskAlert.body).toBeDefined();
    });

    it('should have different content for English and French', () => {
      const en = getTranslations('en');
      const fr = getTranslations('fr');
      
      expect(en.welcome.subject).not.toBe(fr.welcome.subject);
      expect(en.verificationComplete.subject).not.toBe(fr.verificationComplete.subject);
      expect(en.riskAlert.subject).not.toBe(fr.riskAlert.subject);
    });
  });

  describe('Dynamic translation functions', () => {
    it('should generate welcome greeting with name in English', () => {
      const en = getTranslations('en');
      const greeting = en.welcome.greeting('John Doe');
      expect(greeting).toBe('Hi John Doe,');
    });

    it('should generate welcome greeting with name in French', () => {
      const fr = getTranslations('fr');
      const greeting = fr.welcome.greeting('Jean Dupont');
      expect(greeting).toBe('Bonjour Jean Dupont,');
    });

    it('should generate verification complete body in English', () => {
      const en = getTranslations('en');
      const body = en.verificationComplete.body('Test Document', 'abc123');
      expect(body).toContain('Test Document');
      expect(body).toContain('abc123');
    });

    it('should generate verification complete body in French', () => {
      const fr = getTranslations('fr');
      const body = fr.verificationComplete.body('Document Test', 'xyz789');
      expect(body).toContain('Document Test');
      expect(body).toContain('xyz789');
    });

    it('should generate risk alert body with flags in English', () => {
      const en = getTranslations('en');
      const flags = ['Invalid signature', 'Missing watermark'];
      const body = en.riskAlert.body('Suspicious Doc', flags);
      expect(body).toContain('Suspicious Doc');
      expect(body).toContain('Invalid signature');
      expect(body).toContain('Missing watermark');
    });

    it('should generate risk alert body with flags in French', () => {
      const fr = getTranslations('fr');
      const flags = ['Signature invalide', 'Filigrane manquant'];
      const body = fr.riskAlert.body('Doc Suspect', flags);
      expect(body).toContain('Doc Suspect');
      expect(body).toContain('Signature invalide');
      expect(body).toContain('Filigrane manquant');
    });
  });

  describe('SUPPORTED_LANGUAGES', () => {
    it('should include English', () => {
      expect(SUPPORTED_LANGUAGES).toContain('en');
    });

    it('should include French', () => {
      expect(SUPPORTED_LANGUAGES).toContain('fr');
    });

    it('should have exactly 2 languages', () => {
      expect(SUPPORTED_LANGUAGES).toHaveLength(2);
    });
  });

  describe('DEFAULT_LANGUAGE', () => {
    it('should be English', () => {
      expect(DEFAULT_LANGUAGE).toBe('en');
    });
  });
});
