import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ConfigService } from '@nestjs/config';

const DEFAULT_DEV_ORIGIN = 'http://localhost:3000';

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
  const usesSecureCookies = nodeEnv === 'production' || nodeEnv === 'staging';

  const frontendUrl = configService.get<string>('FRONTEND_URL');

  if (isProduction && !frontendUrl) {
    throw new Error(
      'FRONTEND_URL must be explicitly set in production. Credentialed CORS cannot fall back to a development origin.',
    );
  }
  if (usesSecureCookies && !frontendUrl) {
    throw new Error(
      'FRONTEND_URL must be explicitly set when secure cookies are enabled.',
    );
  }

  const appUrl = configService.get<string>('APP_URL');
  if (usesSecureCookies && !appUrl) {
    throw new Error(
      'APP_URL must be explicitly set when secure cookies are enabled.',
    );
  }
  const frontendOrigins = [...parseAllowlist(frontendUrl, false)];
  const appProtocol = appUrl ? new URL(appUrl).protocol : undefined;
  if (usesSecureCookies && appProtocol !== 'https:') {
    throw new Error('APP_URL must use HTTPS when secure cookies are enabled.');
  }
  if (
    usesSecureCookies &&
    frontendOrigins.some((origin) => new URL(origin).protocol !== 'https:')
  ) {
    throw new Error(
      'FRONTEND_URL must use HTTPS when secure cookies are enabled.',
    );
  }
  const cookieDomain = normalizeCookieDomain(
    configService.get<string>('AUTH_COOKIE_DOMAIN'),
  );
  const appHostname = appUrl
    ? normalizeHostname(new URL(appUrl).hostname)
    : undefined;
  const frontendHostnames = frontendOrigins.map(
    (origin) => normalizeHostname(new URL(origin).hostname),
  );
  const hasDifferentFrontendHostname = frontendHostnames.some(
    (hostname) => hostname !== appHostname,
  );
  if (usesSecureCookies && appHostname && hasDifferentFrontendHostname) {
    if (!cookieDomain) {
      throw new Error(
        'AUTH_COOKIE_DOMAIN must be set when the frontend and API use different hostnames.',
      );
    }
    if (
      !domainCoversHost(cookieDomain, appHostname) ||
      frontendHostnames.some(
        (hostname) => !domainCoversHost(cookieDomain, hostname),
      )
    ) {
      throw new Error(
        'AUTH_COOKIE_DOMAIN must cover both the frontend and API hostnames.',
      );
    }
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

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '');
}

function normalizeCookieDomain(domain: string | undefined): string | undefined {
  const normalized = domain?.trim().replace(/^\.+/, '').toLowerCase();
  return normalized || undefined;
}

function domainCoversHost(domain: string, hostname: string): boolean {
  if (!domain.includes('.')) return false;
  return hostname === domain || hostname.endsWith(`.${domain}`);
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
      .forEach((o) => {
        try {
          allowlist.add(new URL(o).origin);
        } catch {
          allowlist.add(o);
        }
      });
  }

  if (allowDevFallback && allowlist.size === 0) {
    allowlist.add(DEFAULT_DEV_ORIGIN);
  }

  return allowlist;
}

export function isAllowedFrontendOrigin(
  configService: ConfigService,
  origin: string,
): boolean {
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  const allowlist = parseAllowlist(
    configService.get<string>('FRONTEND_URL'),
    nodeEnv !== 'production',
  );
  return allowlist.has(origin);
}

export function getFrontendUrl(
  configService: ConfigService,
  fallback = 'http://localhost:3000',
): string {
  const configured = configService.get<string>('FRONTEND_URL');
  if (configured) {
    const first = configured.split(',')[0].trim();
    if (first) return first;
  }
  return fallback;
}
