import {
  ACCESS_TOKEN_COOKIE,
  extractSessionAccessToken,
  getAccessToken,
} from './access-token';

function request(overrides: Partial<{
  headers: Record<string, string>;
  originalUrl: string;
}> = {}) {
  return {
    headers: overrides.headers ?? {},
    originalUrl: overrides.originalUrl ?? '/api/v1/documents',
  } as any;
}

describe('access token extraction', () => {
  it('prefers a bearer token over the session cookie', () => {
    const value = getAccessToken(
      request({
        headers: {
          authorization: 'Bearer bearer-token',
          cookie: `${ACCESS_TOKEN_COOKIE}=cookie-token`,
        },
      }),
    );

    expect(value).toBe('bearer-token');
  });

  it('allows the session cookie only for me and logout', () => {
    expect(
      extractSessionAccessToken(
        request({
          headers: { cookie: `${ACCESS_TOKEN_COOKIE}=cookie-token` },
          originalUrl: '/api/v1/auth/me',
        }),
      ),
    ).toBe('cookie-token');
    expect(
      extractSessionAccessToken(
        request({
          headers: { cookie: `${ACCESS_TOKEN_COOKIE}=cookie-token` },
          originalUrl: '/api/v1/auth/logout/',
        }),
      ),
    ).toBe('cookie-token');
    expect(
      extractSessionAccessToken(
        request({
          headers: { cookie: `${ACCESS_TOKEN_COOKIE}=cookie-token` },
          originalUrl: '/api/v1/documents',
        }),
      ),
    ).toBeNull();
  });

  it('rejects empty and oversized cookie values', () => {
    expect(
      extractSessionAccessToken(
        request({
          headers: { cookie: `${ACCESS_TOKEN_COOKIE}=` },
          originalUrl: '/api/v1/auth/me',
        }),
      ),
    ).toBeNull();
    expect(
      extractSessionAccessToken(
        request({
          headers: { cookie: `${ACCESS_TOKEN_COOKIE}=${'x'.repeat(4097)}` },
          originalUrl: '/api/v1/auth/me',
        }),
      ),
    ).toBeNull();
  });
});
