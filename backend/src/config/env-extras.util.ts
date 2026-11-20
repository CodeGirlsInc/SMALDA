/** #1566: build TypeORM connection options from the validated DATABASE_* variables. */
export function typeOrmConnection(get: (key: string) => string | undefined) {
  const url = get('DATABASE_URL');
  if (url) return { url };
  return {
    host: get('DATABASE_HOST') ?? 'localhost',
    port: Number(get('DATABASE_PORT') ?? 5432),
    username: get('DATABASE_USER'),
    password: get('DATABASE_PASSWORD'),
    database: get('DATABASE_NAME'),
  };
}

/** #1567: @nestjs/throttler v6 shape; ttl is in milliseconds (values under 1000 are treated as seconds). */
export function throttlerOptions(ttl?: string | number, limit?: string | number) {
  const raw = Number(ttl ?? 60000);
  return { throttlers: [{ name: 'default', ttl: raw < 1000 ? raw * 1000 : raw, limit: Number(limit ?? 10) }] };
}

/** #1568: accept winston levels and map the Nest-only 'log' to 'info'. */
export const WINSTON_LEVELS = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'] as const;

export function winstonLevel(level?: string, env = process.env.NODE_ENV): string {
  const value = level === 'log' ? 'info' : level;
  if (value && (WINSTON_LEVELS as readonly string[]).includes(value)) return value;
  return env === 'production' ? 'warn' : 'debug';
}
