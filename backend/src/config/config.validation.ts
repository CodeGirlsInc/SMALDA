import * as Joi from 'joi';

/**
 * Custom validation to ensure placeholder values are not used in production
 */
const notPlaceholder = Joi.string()
  .invalid(
    'your-super-secret-jwt-key-change-this-in-production',
    'your-super-secret-refresh-key-change-this-in-production',
    'your-google-client-id',
    'your-google-client-secret',
    'your-github-client-id',
    'your-github-client-secret',
    'your-email@gmail.com',
    'your-app-password',
    'your-stellar-secret-key',
  )
  .messages({
    'any.invalid':
      'Placeholder value detected - please set a real production value for this environment variable',
  });

/**
 * Joi schema that validates all required environment variables at startup.
 * The app will refuse to start with a clear error if anything is wrong.
 */
export const ConfigValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),

  // ── Server ─────────────────────────────────────────────────────────────────
  APP_PORT: Joi.number().positive().default(3001),
  APP_URL: Joi.string().uri().required(),
  FRONTEND_URL: Joi.string().uri().required(),

  // ── Database ───────────────────────────────────────────────────────────────
  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().positive().default(5432),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),

  // ── Redis ──────────────────────────────────────────────────────────────────
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().positive().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  // ── Stellar ────────────────────────────────────────────────────────────────
  // Defaults to testnet in development; must be explicitly set to "public"
  // in production — any other value in production is rejected.
  STELLAR_NETWORK: Joi.string()
    .valid(
      'Test SDF Network ; September 2015',
      'Public Global Stellar Network ; September 2015',
    )
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string()
        .valid('Public Global Stellar Network ; September 2015')
        .required()
        .messages({
          'any.only':
            'STELLAR_NETWORK must be explicitly set to "Public Global Stellar Network ; September 2015" in production.',
          'any.required':
            'STELLAR_NETWORK is required in production and must be "Public Global Stellar Network ; September 2015".',
        }),
      otherwise: Joi.string().default('Test SDF Network ; September 2015'),
    }),

  STELLAR_SECRET_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: notPlaceholder.required(),
    otherwise: Joi.string().required(),
  }),
  STELLAR_HORIZON_URL: Joi.string().uri().required(),

  // ── Auth ───────────────────────────────────────────────────────────────────
  JWT_SECRET: Joi.string()
    .when('NODE_ENV', {
      is: 'production',
      then: notPlaceholder.min(32).required(),
      otherwise: Joi.string().min(32).required(),
    })
    .messages({
      'string.min': 'JWT_SECRET must be at least 32 characters.',
      'any.required': 'JWT_SECRET is required.',
    }),
  JWT_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: notPlaceholder.min(32).required(),
    otherwise: Joi.string().min(32).required(),
  }),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  // ── OAuth ──────────────────────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: notPlaceholder.required(),
    otherwise: Joi.string().required(),
  }),
  GOOGLE_CLIENT_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: notPlaceholder.required(),
    otherwise: Joi.string().required(),
  }),
  GOOGLE_CALLBACK_URL: Joi.string().uri().required(),

  GITHUB_CLIENT_ID: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: notPlaceholder.required(),
    otherwise: Joi.string().required(),
  }),
  GITHUB_CLIENT_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: notPlaceholder.required(),
    otherwise: Joi.string().required(),
  }),
  GITHUB_CALLBACK_URL: Joi.string().uri().required(),

  // ── Mail ───────────────────────────────────────────────────────────────────
  MAIL_HOST: Joi.string().required(),
  MAIL_PORT: Joi.number().positive().default(587),
  MAIL_USER: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: notPlaceholder.required(),
    otherwise: Joi.string().required(),
  }),
  MAIL_PASSWORD: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: notPlaceholder.required(),
    otherwise: Joi.string().required(),
  }),
  MAIL_FROM: Joi.string().email().required(),

  // Keep SMTP config in sync for compatibility
  SMTP_HOST: Joi.string().default(Joi.ref('MAIL_HOST')),
  SMTP_PORT: Joi.number().default(Joi.ref('MAIL_PORT')),
  SMTP_USER: Joi.string().default(Joi.ref('MAIL_USER')),
  SMTP_PASS: Joi.string().default(Joi.ref('MAIL_PASSWORD')),
  SMTP_FROM: Joi.string().default(Joi.ref('MAIL_FROM')),

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  THROTTLE_TTL: Joi.number().positive().default(60),
  THROTTLE_LIMIT: Joi.number().positive().default(10),

  // ── File Upload ────────────────────────────────────────────────────────────
  UPLOAD_DIR: Joi.string().default('./uploads'),

  // ── Logging ────────────────────────────────────────────────────────────────
  // Defaults to "debug" in development and "warn" in production.
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'log', 'debug', 'verbose')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().default('warn'),
      otherwise: Joi.string().default('debug'),
    }),
});
