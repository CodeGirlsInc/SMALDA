import { ConfigService } from '@nestjs/config';
import {
  getSessionCookieDomain,
  validateSessionCookieTopology,
} from './session-cookie.config';

function config(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

describe('session cookie topology', () => {
  it('allows same-host origins without a parent domain', () => {
    expect(() =>
      validateSessionCookieTopology(
        config({
          NODE_ENV: 'production',
          APP_URL: 'https://app.example.test',
          FRONTEND_URL: 'https://app.example.test',
        }),
      ),
    ).not.toThrow();
  });

  it('rejects cross-host production cookies without a shared domain', () => {
    expect(() =>
      validateSessionCookieTopology(
        config({
          NODE_ENV: 'production',
          APP_URL: 'https://api.example.test',
          FRONTEND_URL: 'https://app.example.test',
        }),
      ),
    ).toThrow('SESSION_COOKIE_DOMAIN');
  });

  it('accepts a shared parent domain and returns its normalized value', () => {
    const service = config({
      NODE_ENV: 'production',
      APP_URL: 'https://api.example.test',
      FRONTEND_URL: 'https://app.example.test',
      SESSION_COOKIE_DOMAIN: '.Example.Test',
    });

    expect(() => validateSessionCookieTopology(service)).not.toThrow();
    expect(getSessionCookieDomain(service)).toBe('example.test');
  });
});
