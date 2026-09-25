import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

export const ACCESS_COOKIE_NAME = 'access_token';
export const REFRESH_COOKIE_NAME = 'refresh_token';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

interface AuthCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax' | 'none';
  path: string;
  domain?: string;
}

function getCookieOptions(configService: ConfigService): AuthCookieOptions {
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  const secure = nodeEnv === 'production' || nodeEnv === 'staging';
  const domain = configService.get<string>('AUTH_COOKIE_DOMAIN')?.trim();

  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    ...(domain ? { domain } : {}),
  };
}

function durationMilliseconds(
  value: string | undefined,
  fallbackSeconds: number,
): number {
  const normalized = value?.trim();
  if (!normalized) return fallbackSeconds * 1000;

  if (/^\d+$/.test(normalized)) return Number(normalized) * 1000;

  const match = /^(\d+)([smhd])$/.exec(normalized);
  if (!match) return fallbackSeconds * 1000;

  const amount = Number(match[1]);
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 } as const;
  return amount * multipliers[match[2] as keyof typeof multipliers] * 1000;
}

export function setAuthCookies(
  response: Response | undefined,
  tokens: AuthTokens,
  configService: ConfigService,
): void {
  if (!response) return;

  const options = getCookieOptions(configService);
  response.cookie(ACCESS_COOKIE_NAME, tokens.access_token, {
    ...options,
    maxAge: durationMilliseconds(configService.get<string>('JWT_EXPIRATION'), 900),
  });
  response.cookie(REFRESH_COOKIE_NAME, tokens.refresh_token, {
    ...options,
    maxAge: durationMilliseconds(
      configService.get<string>('JWT_REFRESH_EXPIRATION'),
      604800,
    ),
  });
}

export function clearAuthCookies(
  response: Response | undefined,
  configService: ConfigService,
): void {
  if (!response) return;

  const options = getCookieOptions(configService);
  response.clearCookie(ACCESS_COOKIE_NAME, options);
  response.clearCookie(REFRESH_COOKIE_NAME, options);
}

export function getCookieValue(
  cookieHeader: string | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;

    const key = part.slice(0, separator).trim();
    if (key !== name) continue;

    const value = part.slice(separator + 1).trim();
    if (!value) return undefined;

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return undefined;
}
