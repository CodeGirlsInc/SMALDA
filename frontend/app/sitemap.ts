import { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { getSiteUrl } from '@/lib/site-url';

/** Public pages only: everything else is behind login or does not exist. */
export const PUBLIC_PATHS = ['', '/login', '/register', '/forgot-password'];

function getLocalizedPath(path: string, locale: string): string {
  if (locale === routing.defaultLocale) {
    return path;
  }
  return `/${locale}${path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const entries: MetadataRoute.Sitemap = [];

  for (const path of PUBLIC_PATHS) {
    for (const locale of routing.locales) {
      const localizedPath = getLocalizedPath(path, locale);
      entries.push({
        url: `${baseUrl}${localizedPath}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: path === '' ? 1 : 0.8,
        alternates: {
          languages: Object.fromEntries(
            routing.locales.map((l) => [
              l,
              `${baseUrl}${getLocalizedPath(path, l)}`,
            ]),
          ),
        },
      });
    }
  }

  return entries;
}
