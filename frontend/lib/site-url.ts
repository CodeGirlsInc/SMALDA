const DEFAULT_SITE_URL = "https://smalda.org";

/** Public origin used in the sitemap and robots.txt (`NEXT_PUBLIC_SITE_URL`). */
export function getSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  return raw || DEFAULT_SITE_URL;
}
