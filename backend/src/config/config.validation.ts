import * as Joi from 'joi';

/**
 * Joi schema that validates all required environment variables at startup.
 * The app will refuse to start with a clear error if anything is wrong.
 */
export const ConfigValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),

  // ── Server ─────────────────────────────────────────────────────────────────
  PORT: Joi.number().default(3001),

  // ── Database ───────────────────────────────────────────────────────────────
  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),

  // ── Redis ──────────────────────────────────────────────────────────────────
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),

  // ── Stellar ────────────────────────────────────────────────────────────────
  // Defaults to testnet in development; must be explicitly set to "public"
  // in production — any other value in production is rejected.
  STELLAR_NETWORK: Joi.string()
    .valid('testnet', 'public')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().valid('public').required().messages({
        'any.only':
          'STELLAR_NETWORK must be explicitly set to "public" in production.',
        'any.required':
          'STELLAR_NETWORK is required in production and must be "public".',
      }),
      otherwise: Joi.string().valid('testnet', 'public').default('testnet'),
    }),

  STELLAR_HORIZON_URL: Joi.string().uri().required(),

  // ── Auth ───────────────────────────────────────────────────────────────────
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_SECRET must be at least 32 characters.',
    'any.required': 'JWT_SECRET is required.',
  }),

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
