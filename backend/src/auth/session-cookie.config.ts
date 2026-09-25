import { ConfigService } from '@nestjs/config';

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\.+|\.+$/g, '');
}

function parseOrigins(value: string | undefined, name: string): URL[] {
  if (!value) {
    throw new Error(`${name} must be configured.`);
  }

  return value.split(',').map((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) {
      throw new Error(`${name} contains an empty origin.`);
    }

    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'https:' || url.search || url.hash) {
        throw new Error('invalid origin');
      }
      return url;
    } catch {
      throw new Error(`${name} must contain only absolute HTTPS origins in production.`);
    }
  });
}

function isWithinDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function validateSessionCookieTopology(configService: ConfigService): void {
  if (configService.get<string>('NODE_ENV') !== 'production') return;

  const appOrigins = parseOrigins(configService.get<string>('APP_URL'), 'APP_URL');
  const frontendOrigins = parseOrigins(
    configService.get<string>('FRONTEND_URL'),
    'FRONTEND_URL',
  );
  const appHost = normalizeHostname(appOrigins[0].hostname);
  const frontendHosts = frontendOrigins.map((origin) =>
    normalizeHostname(origin.hostname),
  );

  const configuredDomain = normalizeHostname(
    configService.get<string>('SESSION_COOKIE_DOMAIN') ?? '',
  );
  if (frontendHosts.every((hostname) => hostname === appHost)) {
    if (
      configuredDomain &&
      (!isWithinDomain(appHost, configuredDomain) ||
        frontendHosts.some((hostname) => !isWithinDomain(hostname, configuredDomain)))
    ) {
      throw new Error(
        `SESSION_COOKIE_DOMAIN "${configuredDomain}" must contain APP_URL and every FRONTEND_URL host.`,
      );
    }
    return;
  }

  if (!configuredDomain) {
    throw new Error(
      'Production browser sessions require same-origin API/frontend hosting or SESSION_COOKIE_DOMAIN set to a shared parent domain. Host-only cookies cannot authenticate a different production host.',
    );
  }

  if (
    !isWithinDomain(appHost, configuredDomain) ||
    frontendHosts.some((hostname) => !isWithinDomain(hostname, configuredDomain))
  ) {
    throw new Error(
      `SESSION_COOKIE_DOMAIN "${configuredDomain}" must be a shared parent domain of APP_URL and every FRONTEND_URL host.`,
    );
  }
}

export function getSessionCookieDomain(configService: ConfigService): string | undefined {
  if (configService.get<string>('NODE_ENV') !== 'production') return undefined;

  const configured = configService.get<string>('SESSION_COOKIE_DOMAIN');
  return configured ? normalizeHostname(configured) : undefined;
}
