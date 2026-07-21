import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

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
export default createMiddleware(routing);

export const config = {
  // Skip Next.js internals, API routes and static files (anything with a dot).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
