
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

type OriginCallback = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) => void;

interface CorsConfig {
  origin: boolean | string | string[] | RegExp | OriginCallback;
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
}

describe('CORS configuration', () => {
  const createConfig = (overrides: Partial<CorsConfig> = {}): CorsOptions => ({
    origin: true,
    credentials: true,
    ...overrides,
  });

  it('should allow requests from any origin in development', () => {
    const config = createConfig({ origin: true });
    expect(config.origin).toBe(true);
  });

  it('should restrict origin to specific domains in production', () => {
    const allowedOrigins = ['https://smalda.app', 'https://www.smalda.app'];
    const config = createConfig({ origin: allowedOrigins });
    expect(config.origin).toEqual(allowedOrigins);
  });

  it('should support origin as a function', () => {
    const originFn: OriginCallback = (origin, callback) => {
      callback(null, true);
    };
    const config = createConfig({ origin: originFn });
    expect(typeof config.origin).toBe('function');
  });

  it('should enable credentials by default', () => {
    const config = createConfig();
    expect(config.credentials).toBe(true);

import { ConfigService } from '@nestjs/config';
import { buildCorsOptions, getFrontendUrl } from './cors.config';

describe('buildCorsOptions', () => {
  function createConfigService(values: Record<string, string>): ConfigService {
    return {
      get: (key: string) => values[key],
    } as unknown as ConfigService;
  }

  it('should allow the configured origin in development', (done) => {
    const config = createConfigService({
      NODE_ENV: 'development',
      FRONTEND_URL: 'http://localhost:3001',
    });
    const { corsOptions } = buildCorsOptions(config);

    (corsOptions.origin as Function)(
      'http://localhost:3001',
      (err: Error | null, allow?: boolean) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      },
    );
  });

  it('should allow multiple origins from a comma-separated list', (done) => {
    const config = createConfigService({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.example.com,https://admin.example.com',
    });
    const { corsOptions } = buildCorsOptions(config);

    (corsOptions.origin as Function)(
      'https://admin.example.com',
      (err: Error | null, allow?: boolean) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      },
    );
  });

  it('should reject a disallowed origin', (done) => {
    const config = createConfigService({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.example.com',
    });
    const { corsOptions } = buildCorsOptions(config);

    (corsOptions.origin as Function)(
      'https://evil.example.com',
      (err: Error | null, allow?: boolean) => {
        expect(err).toBeInstanceOf(Error);
        expect(allow).toBe(false);
        done();
      },
    );
  });

  it('should refuse to start in production without FRONTEND_URL', () => {
    const config = createConfigService({ NODE_ENV: 'production' });
    expect(() => buildCorsOptions(config)).toThrow(
      'FRONTEND_URL must be explicitly set in production',
    );
  });

  it('should fall back to localhost in development when FRONTEND_URL is unset', (done) => {
    const config = createConfigService({ NODE_ENV: 'development' });
    const { corsOptions } = buildCorsOptions(config);

    (corsOptions.origin as Function)(
      'http://localhost:3001',
      (err: Error | null, allow?: boolean) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      },
    );
  });

  it('should restrict methods and headers', () => {
    const config = createConfigService({
      NODE_ENV: 'development',
      FRONTEND_URL: 'http://localhost:3001',
    });
    const { corsOptions } = buildCorsOptions(config);

    expect(corsOptions.methods).toContain('GET');
    expect(corsOptions.methods).toContain('POST');
    expect(corsOptions.allowedHeaders).toContain('Authorization');
    expect(corsOptions.allowedHeaders).toContain('X-Request-Id');
    expect(corsOptions.credentials).toBe(true);
  });
});

describe('getFrontendUrl', () => {
  function createConfigService(values: Record<string, string>): ConfigService {
    return {
      get: (key: string) => values[key],
    } as unknown as ConfigService;
  }

  it('returns the first configured origin', () => {
    const config = createConfigService({
      FRONTEND_URL: 'https://a.example.com,https://b.example.com',
    });
    expect(getFrontendUrl(config)).toBe('https://a.example.com');
  });

  it('returns fallback when nothing is configured', () => {
    const config = createConfigService({});
    expect(getFrontendUrl(config)).toBe('http://localhost:3001');

  });
});
