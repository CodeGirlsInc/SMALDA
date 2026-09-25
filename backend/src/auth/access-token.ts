import { Request } from 'express';

export const ACCESS_TOKEN_COOKIE = 'smalda_access_token';
export const LEGACY_ACCESS_TOKEN_COOKIE = 'token';

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.cookie;
  if (!header) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;

    const rawValue = part.slice(separator + 1).trim();
    if (!rawValue || rawValue.length > 4096) return null;

    try {
      const value = decodeURIComponent(rawValue);
      return value.length > 0 && value.length <= 4096 ? value : null;
    } catch {
      return null;
    }
  }

  return null;
}

export function getAccessToken(request: Request): string | null {
  const authorization = request.headers.authorization;
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) return match[1].trim() || null;
  }

  return readCookie(request, ACCESS_TOKEN_COOKIE);
}

export function getSessionCookieToken(request: Request): string | null {
  return readCookie(request, ACCESS_TOKEN_COOKIE);
}

export function extractSessionAccessToken(request: Request): string | null {
  const path = (request.originalUrl || request.url || '')
    .split('?')[0]
    .replace(/\/+$/, '');
  if (!path.endsWith('/auth/me') && !path.endsWith('/auth/logout')) {
    return null;
  }
  return getSessionCookieToken(request);
}
