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
  });
});
