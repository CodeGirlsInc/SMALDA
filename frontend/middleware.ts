import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * next-intl middleware — handles locale detection (via the `NEXT_LOCALE`
 * cookie and the `Accept-Language` header) and locale prefixing of requests.
 *
 * NOTE (FE-04): when the authentication middleware lands, compose the two by
 * running this locale middleware first and then the auth checks, e.g.:
 *
 *   export default function middleware(request: NextRequest) {
 *     const response = intlMiddleware(request);
 *     // ...auth redirects, reading/writing `response` headers/cookies...
 *     return response;
 *   }
 */
const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // Extract the locale segment from the URL
  const pathname = request.nextUrl.pathname;
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0];

  // If the first segment looks like a locale but isn't supported,
  // redirect to the default locale rather than showing an error.
  if (firstSegment && firstSegment.length === 2 && !routing.locales.includes(firstSegment as any)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${routing.defaultLocale}${pathname}`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  // Skip Next.js internals, API routes and static files (anything with a dot).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
