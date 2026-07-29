import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ConfigService } from '@nestjs/config';

const DEFAULT_DEV_ORIGIN = 'http://localhost:3001';

const ALLOWED_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'];

const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'Accept',
  'Origin',
  'X-Request-Id',
];

/**
 * Build hardened CORS options from configuration.
 *
 * FRONTEND_URL may be a comma-separated list of exact origins. In production
 * the variable is required; in development it falls back to localhost so
 * local frontend work continues without extra env setup.
 *
 * The origin callback never reflects an arbitrary Origin header; it only
 * permits exact matches from the configured allowlist.
 */
export function buildCorsOptions(
  configService: ConfigService,
): { isProduction: boolean; corsOptions: CorsOptions } {
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  const isProduction = nodeEnv === 'production';

  const frontendUrl = configService.get<string>('FRONTEND_URL');

  if (isProduction && !frontendUrl) {
    throw new Error(
      'FRONTEND_URL must be explicitly set in production. Credentialed CORS cannot fall back to a development origin.',
    );
  }

  const allowlist = parseAllowlist(frontendUrl, !isProduction);

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow same-origin / non-browser requests (e.g. server-to-server,
      // health checks, mobile apps) when no Origin header is present.
      if (!origin) {
        return callback(null, true);
      }

      if (allowlist.has(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`Origin ${origin} is not allowed by CORS`),
        false,
      );
    },
    credentials: true,
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS,
  };

  return { isProduction, corsOptions };
}

function parseAllowlist(
  frontendUrl: string | undefined,
  allowDevFallback: boolean,
): Set<string> {
  const allowlist = new Set<string>();

  if (frontendUrl) {
    frontendUrl
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0)
      .forEach((o) => allowlist.add(o));
  }

  if (allowDevFallback && allowlist.size === 0) {
    allowlist.add(DEFAULT_DEV_ORIGIN);
  }

  return allowlist;
}

export function getFrontendUrl(
  configService: ConfigService,
  fallback = 'http://localhost:3001',
): string {
  const configured = configService.get<string>('FRONTEND_URL');
  if (configured) {
    const first = configured.split(',')[0].trim();
    if (first) return first;
  }
  return fallback;
}
