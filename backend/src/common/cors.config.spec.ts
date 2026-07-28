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
