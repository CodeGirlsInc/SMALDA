import { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';

const BASE_URL = 'https://smalda.org';

function getLocalizedPath(path: string, locale: string): string {
  if (locale === routing.defaultLocale) {
    return path;
  }
  return `/${locale}${path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    '',
    '/documents',
    '/verify',
    '/dashboard',
    '/settings',
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const path of staticPaths) {
    for (const locale of routing.locales) {
      const localizedPath = getLocalizedPath(path, locale);
      entries.push({
        url: `${BASE_URL}${localizedPath}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: path === '' ? 1 : 0.8,
        alternates: {
          languages: Object.fromEntries(
            routing.locales.map((l) => [
              l,
              `${BASE_URL}${getLocalizedPath(path, l)}`,
            ]),
          ),
        },
      });
    }
  }

  return entries;
}
