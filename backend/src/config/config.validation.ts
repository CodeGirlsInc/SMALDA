import * as Joi from 'joi';

/**
 * Joi schema that validates all required environment variables at startup.
 * The app will refuse to start with a clear error if anything is wrong.
 *
 * Extended in #747 to require STELLAR_SECRET_KEY and accept OAuth secrets,
 * the frontend URL, upload directory, app port, mail settings, and throttler
 * tuning with sensible defaults. OAuth credentials are optional; the auth
 * module emits a startup warning if a provider is partially configured.
 */
export const ConfigValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),

  // ── Server ─────────────────────────────────────────────────────────────────
  PORT: Joi.number().default(3001),
  APP_PORT: Joi.number().default(6004).messages({
    'number.base': 'APP_PORT must be a valid port number.',
  }),

  // ── Database ───────────────────────────────────────────────────────────────
  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),

  // ── Redis ──────────────────────────────────────────────────────────────────
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  // ── Stellar ────────────────────────────────────────────────────────────────
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

  // Required for signing anchoring transactions. Must be a full Stellar
  // secret key (typically starts with 'S'). Min 32 protects against
  // truncated/placeholder values being committed by mistake.
  STELLAR_SECRET_KEY: Joi.string()
    .min(32)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .messages({
      'string.min':
        'STELLAR_SECRET_KEY must be at least 32 characters. Use the full Stellar secret key issued by the Stellar keypair generator.',
      'any.required':
        'STELLAR_SECRET_KEY is required in production for signing Stellar anchoring transactions. Generate a keypair at https://www.stellar.org/laboratory/#account-creator?network=test (testnet) and put the secret in your .env.',
      'string.empty':
        'STELLAR_SECRET_KEY must not be empty in production.',
    }),

  // ── Auth ───────────────────────────────────────────────────────────────────
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_SECRET must be at least 32 characters.',
    'any.required': 'JWT_SECRET is required.',
  }),
  JWT_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_REFRESH_SECRET must be at least 32 characters.',
    'any.required': 'JWT_REFRESH_SECRET is required.',
  }),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  // ── Frontend / CORS ────────────────────────────────────────────────────────
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3001').messages({
    'string.uri': 'FRONTEND_URL must be a valid URL.',
  }),

  // ── File Uploads ───────────────────────────────────────────────────────────
  UPLOAD_DIR: Joi.string().default('./uploads'),

  // ── OAuth (Google + GitHub) ────────────────────────────────────────────────
  // OAuth credentials are optional. Both halves of a provider's creds should
  // be set together; the auth module surfaces a startup warning otherwise.
  GOOGLE_CLIENT_ID: Joi.string().optional().allow(''),
  GOOGLE_CLIENT_SECRET: Joi.string().optional().allow(''),
  GOOGLE_CALLBACK_URL: Joi.string().uri().optional(),

  GITHUB_CLIENT_ID: Joi.string().optional().allow(''),
  GITHUB_CLIENT_SECRET: Joi.string().optional().allow(''),
  GITHUB_CALLBACK_URL: Joi.string().uri().optional(),

  // ── Email (Nodemailer) ─────────────────────────────────────────────────────
  MAIL_HOST: Joi.string().optional().allow(''),
  MAIL_PORT: Joi.number().optional(),
  MAIL_USER: Joi.string().optional().allow(''),
  MAIL_PASSWORD: Joi.string().optional().allow(''),
  MAIL_FROM: Joi.string().optional().allow(''),

  SMTP_HOST: Joi.string().optional().allow(''),
  SMTP_PORT: Joi.number().optional(),
  SMTP_USER: Joi.string().optional().allow(''),
  SMTP_PASS: Joi.string().optional().allow(''),
  SMTP_FROM: Joi.string().optional().allow(''),

  // ── Rate Limiting (Throttler) ───────────────────────────────────────────────
  THROTTLE_TTL: Joi.number().integer().min(1).default(60).messages({
    'number.min': 'THROTTLE_TTL must be at least 1 second.',
  }),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(10).messages({
    'number.min': 'THROTTLE_LIMIT must be at least 1.',
  }),

  // ── Logging ────────────────────────────────────────────────────────────────
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'log', 'debug', 'verbose')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().default('warn'),
      otherwise: Joi.string().default('debug'),
    }),
})
  .custom((value, helpers) => {
    // Reject half-configured OAuth providers (e.g. CLIENT_ID set without SECRET).
    const ensurePair = (idKey: string, secretKey: string, provider: string) => {
      const hasId = !!(value as Record<string, unknown>)[idKey];
      const hasSecret = !!(value as Record<string, unknown>)[secretKey];
      if (hasId !== hasSecret) {
        return helpers.error('any.invalid', {
          message: `${provider}_CLIENT_ID and ${provider}_CLIENT_SECRET must both be set or both be empty.`,
        });
      }
    };
    ensurePair('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE');
    ensurePair('GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB');
    return value;
  })
  .messages({
    'any.invalid': '{#message}',
  });
