import { ConfigService } from '@nestjs/config';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  clearAuthCookies,
  getCookieValue,
  setAuthCookies,
} from './auth-cookie';

describe('auth cookies', () => {
  it('sets secure HttpOnly cookies for production origins', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'AUTH_COOKIE_DOMAIN') return 'example.com';
        if (key === 'JWT_EXPIRATION') return '15m';
        if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
        return undefined;
      }),
    } as unknown as ConfigService;
    const response = { cookie: jest.fn(), clearCookie: jest.fn() };

    setAuthCookies(
      response as never,
      { access_token: 'access', refresh_token: 'refresh' },
      config,
    );

    expect(response.cookie).toHaveBeenCalledWith(
      ACCESS_COOKIE_NAME,
      'access',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        domain: 'example.com',
        path: '/',
        maxAge: 900000,
      }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'refresh',
      expect.objectContaining({ httpOnly: true, maxAge: 604800000 }),
    );
  });

  it('parses encoded cookie values and clears both cookies', () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'NODE_ENV' ? 'development' : undefined,
      ),
    } as unknown as ConfigService;
    const response = { cookie: jest.fn(), clearCookie: jest.fn() };

    expect(
      getCookieValue(
        'other=value; access_token=access%2Bvalue; refresh_token=refresh',
        ACCESS_COOKIE_NAME,
      ),
    ).toBe('access+value');

    clearAuthCookies(response as never, config);
    expect(response.clearCookie).toHaveBeenCalledTimes(2);
  });
});
