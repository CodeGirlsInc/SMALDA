import sitemap from '@/app/sitemap';

describe('sitemap', () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  });

  it('lists only public pages', () => {
    const urls = sitemap().map((e) => e.url);
    for (const protectedPath of ['/documents', '/settings', '/dashboard']) {
      expect(urls.some((u) => u.endsWith(protectedPath))).toBe(false);
    }
    expect(urls.some((u) => u.endsWith('/login'))).toBe(true);
  });

  it('takes the base URL from NEXT_PUBLIC_SITE_URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://staging.example.test/';
    const urls = sitemap().map((e) => e.url);
    expect(urls.every((u) => u.startsWith('https://staging.example.test'))).toBe(true);
  });
});
