import { ConfigValidationSchema } from './config.validation';

/**
 * Returns a fully valid environment object with sensible defaults.
 * Tests selectively remove or corrupt keys.
 */
function validEnv(): Record<string, string> {
  return {
    NODE_ENV: 'development',
    APP_PORT: '3001',
    APP_URL: 'http://localhost:3001',
    FRONTEND_URL: 'http://localhost:3000',
    DATABASE_HOST: 'localhost',
    DATABASE_PORT: '5432',
    DATABASE_USER: 'postgres',
    DATABASE_PASSWORD: 'secret',
    DATABASE_NAME: 'testdb',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    STELLAR_NETWORK: 'Test SDF Network ; September 2015',
    STELLAR_SECRET_KEY: 'SAEXAMPLEKEY',
    STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
    JWT_SECRET: 'a'.repeat(32),
    JWT_EXPIRATION: '15m',
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    JWT_REFRESH_EXPIRATION: '7d',
    GOOGLE_CLIENT_ID: 'google-id',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    GOOGLE_CALLBACK_URL: 'http://localhost:3001/auth/google/callback',
    GITHUB_CLIENT_ID: 'github-id',
    GITHUB_CLIENT_SECRET: 'github-secret',
    GITHUB_CALLBACK_URL: 'http://localhost:3001/auth/github/callback',
    MAIL_HOST: 'smtp.example.com',
    MAIL_PORT: '587',
    MAIL_USER: 'user@example.com',
    MAIL_PASSWORD: 'mailpass',
    MAIL_FROM: 'no-reply@example.com',
  };
}

function validate(env: Record<string, string>) {
  return ConfigValidationSchema.validate(env, { abortEarly: false });
}

describe('ConfigValidationSchema', () => {
  describe('valid configuration', () => {
    it('should pass validation with all required keys present', () => {
      const { error } = validate(validEnv());
      expect(error).toBeUndefined();
    });
  });

  describe('missing required keys', () => {
    it('should reject when STELLAR_SECRET_KEY is missing', () => {
      const env = validEnv();
      delete env.STELLAR_SECRET_KEY;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('STELLAR_SECRET_KEY');
    });

    it('should reject when DATABASE_HOST is missing', () => {
      const env = validEnv();
      delete env.DATABASE_HOST;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('DATABASE_HOST');
    });

    it('should reject when DATABASE_USER is missing', () => {
      const env = validEnv();
      delete env.DATABASE_USER;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('DATABASE_USER');
    });

    it('should reject when DATABASE_PASSWORD is missing', () => {
      const env = validEnv();
      delete env.DATABASE_PASSWORD;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('DATABASE_PASSWORD');
    });

    it('should reject when DATABASE_NAME is missing', () => {
      const env = validEnv();
      delete env.DATABASE_NAME;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('DATABASE_NAME');
    });

    it('should reject when APP_URL is missing', () => {
      const env = validEnv();
      delete env.APP_URL;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('APP_URL');
    });

    it('should reject when FRONTEND_URL is missing', () => {
      const env = validEnv();
      delete env.FRONTEND_URL;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('FRONTEND_URL');
    });

    it('should reject when JWT_SECRET is missing', () => {
      const env = validEnv();
      delete env.JWT_SECRET;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('JWT_SECRET');
    });

    it('should reject when JWT_REFRESH_SECRET is missing', () => {
      const env = validEnv();
      delete env.JWT_REFRESH_SECRET;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('JWT_REFRESH_SECRET');
    });

    it('should reject when STELLAR_HORIZON_URL is missing', () => {
      const env = validEnv();
      delete env.STELLAR_HORIZON_URL;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('STELLAR_HORIZON_URL');
    });

    it('should reject when GOOGLE_CLIENT_ID is missing', () => {
      const env = validEnv();
      delete env.GOOGLE_CLIENT_ID;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('GOOGLE_CLIENT_ID');
    });

    it('should reject when GOOGLE_CLIENT_SECRET is missing', () => {
      const env = validEnv();
      delete env.GOOGLE_CLIENT_SECRET;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('GOOGLE_CLIENT_SECRET');
    });

    it('should reject when GITHUB_CLIENT_ID is missing', () => {
      const env = validEnv();
      delete env.GITHUB_CLIENT_ID;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('GITHUB_CLIENT_ID');
    });

    it('should reject when GITHUB_CLIENT_SECRET is missing', () => {
      const env = validEnv();
      delete env.GITHUB_CLIENT_SECRET;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('GITHUB_CLIENT_SECRET');
    });

    it('should reject when MAIL_HOST is missing', () => {
      const env = validEnv();
      delete env.MAIL_HOST;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('MAIL_HOST');
    });

    it('should reject when MAIL_USER is missing', () => {
      const env = validEnv();
      delete env.MAIL_USER;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('MAIL_USER');
    });

    it('should reject when MAIL_PASSWORD is missing', () => {
      const env = validEnv();
      delete env.MAIL_PASSWORD;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('MAIL_PASSWORD');
    });

    it('should reject when MAIL_FROM is missing', () => {
      const env = validEnv();
      delete env.MAIL_FROM;
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('MAIL_FROM');
    });
  });

  describe('out-of-range and malformed values', () => {
    it('should reject a negative DATABASE_PORT', () => {
      const env = validEnv();
      env.DATABASE_PORT = '-1';
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('DATABASE_PORT');
    });

    it('should reject a non-numeric DATABASE_PORT', () => {
      const env = validEnv();
      env.DATABASE_PORT = 'not-a-number';
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('DATABASE_PORT');
    });

    it('should reject a negative APP_PORT', () => {
      const env = validEnv();
      env.APP_PORT = '-500';
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('APP_PORT');
    });

    it('should reject a negative REDIS_PORT', () => {
      const env = validEnv();
      env.REDIS_PORT = '-100';
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('REDIS_PORT');
    });

    it('should reject a negative THROTTLE_TTL', () => {
      const env = validEnv();
      env.THROTTLE_TTL = '-10';
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('THROTTLE_TTL');
    });

    it('should reject a negative THROTTLE_LIMIT', () => {
      const env = validEnv();
      env.THROTTLE_LIMIT = '-5';
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('THROTTLE_LIMIT');
    });

    it('should reject an invalid APP_URL (not a URI)', () => {
      const env = validEnv();
      env.APP_URL = 'not-a-url';
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('APP_URL');
    });

    it('should reject an invalid FRONTEND_URL (not a URI)', () => {
      const env = validEnv();
      env.FRONTEND_URL = 'not-a-url';
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('FRONTEND_URL');
    });

    it('should reject an invalid MAIL_FROM (not an email)', () => {
      const env = validEnv();
      env.MAIL_FROM = 'not-an-email';
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('MAIL_FROM');
    });

    it('should reject an invalid STELLAR_HORIZON_URL (not a URI)', () => {
      const env = validEnv();
      env.STELLAR_HORIZON_URL = 'not-a-url';
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('STELLAR_HORIZON_URL');
    });

    it('should reject a JWT_SECRET shorter than 32 characters', () => {
      const env = validEnv();
      env.JWT_SECRET = 'short';
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('JWT_SECRET');
    });

    it('should reject a JWT_REFRESH_SECRET shorter than 32 characters', () => {
      const env = validEnv();
      env.JWT_REFRESH_SECRET = 'short';
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('JWT_REFRESH_SECRET');
    });

    it('should reject an invalid NODE_ENV value', () => {
      const env = validEnv();
      env.NODE_ENV = 'invalid';
      const { error } = validate(env);
      expect(error).toBeDefined();
      expect(error!.message).toContain('NODE_ENV');
    });

    it('should reject placeholder values in production', () => {
      const env = validEnv();
      env.NODE_ENV = 'production';
      env.JWT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';
      const { error } = validate(env);
      expect(error).toBeDefined();
      // The error details should reference JWT_SECRET and mention placeholders
      const jwtDetail = error!.details.find((d) => d.path?.includes('JWT_SECRET'));
      expect(jwtDetail).toBeDefined();
      expect(jwtDetail!.message).toContain('Placeholder value detected');
    });
  });
});
