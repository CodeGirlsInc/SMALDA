import { WinstonModuleOptions } from 'nest-winston';
import { format, transports } from 'winston';
import { TransformableInfo } from 'logform';

import { getCorrelationId } from './correlation/correlation-id.storage';

const REDACTED = '[REDACTED]';

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'api_key',
  'apikey',
  'client_secret',
  'smtp_pass',
  'mail_password',
  'database_password',
  'redis_password',
  'stellar_secret_key',
]);

function isSensitiveKey(key: string): boolean {
  // Normalize camelCase to snake_case so 'stellarSecretKey' matches the same
  // rules as 'stellar_secret_key' - object keys in JS/TS code are
  // conventionally camelCase even when the underlying env var is snake_case.
  const lower = key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
  return (
    SENSITIVE_KEYS.has(lower) ||
    lower.endsWith('_token') ||
    lower.endsWith('_secret') ||
    lower.endsWith('_password') ||
    lower.endsWith('_key')
  );
}

function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > 0 ? REDACTED : value;
  }
  if (Array.isArray(value)) {
    return value.map(() => REDACTED);
  }
  if (typeof value === 'object') {
    return REDACTED;
  }
  return value;
}

function redact(info: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(info)) {
    if (isSensitiveKey(key)) {
      result[key] = redactValue(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? redact(item as Record<string, unknown>)
          : item,
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redact(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

const redactionFormat = format((info: TransformableInfo) => {
  const redacted = redact(info as Record<string, unknown>);
  Object.keys(info).forEach((key) => delete (info as Record<string, unknown>)[key]);
  Object.assign(info, redacted);
  return info;
});

const correlationFormat = format((info: TransformableInfo) => {
  (info as Record<string, unknown>).requestId = getCorrelationId();
  return info;
});

const baseFormat = format.combine(
  format.timestamp(),
  correlationFormat(),
  format.errors({ stack: true }),
  redactionFormat(),
  format.json(),
);

export function buildWinstonOptions(level?: string): WinstonModuleOptions {
  return {
    level: level || process.env.LOG_LEVEL || 'info',
    format: baseFormat,
    transports: [new transports.Console()],
  };
}
