import { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { getSiteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  const protectedPaths = [
    '/dashboard',
    '/documents',
    '/admin',
    '/map',
    '/settings',
    '/profile',
    '/reports',
    '/disputes',
    '/2fa',
  ];

  // Generate disallow entries for all locales
  const disallowedPaths: string[] = ['/verify/', '/api/'];
  
  for (const path of protectedPaths) {
    for (const locale of routing.locales) {
      if (locale === routing.defaultLocale) {
        disallowedPaths.push(`${path}/`);
      } else {
        disallowedPaths.push(`/${locale}${path}/`);
      }
    }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: disallowedPaths,
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
