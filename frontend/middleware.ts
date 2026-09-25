import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { apiUrl } from "./lib/api-config";

const ACCESS_TOKEN_COOKIE = "smalda_access_token";
const ADMIN_CHECK_TIMEOUT_MS = 5000;

type AdminCheck = "admin" | "forbidden" | "unauthenticated" | "temporary";

type Locale = (typeof routing.locales)[number];

function isLocale(value: string | undefined): value is Locale {
  return (
    value !== undefined &&
    routing.locales.includes(value as Locale)
  );
}

function getPathSegments(pathname: string): string[] | null {
  try {
    const segments = pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));

    if (
      segments.some(
        (segment) =>
          segment.includes("/") ||
          segment.includes("\\") ||
          segment === "." ||
          segment === ".." ||
          /%(?:2f|5c)/i.test(segment),
      )
    ) {
      return null;
    }

    return segments;
  } catch {
    return null;
  }
}

export function isAdminPath(pathname: string): boolean {
  const segments = getPathSegments(pathname);
  if (!segments) return false;
  if (segments[0] === "admin") return true;
  return isLocale(segments[0]) && segments[1] === "admin";
}

function stripLocalePrefix(pathname: string): string {
  const segments = getPathSegments(pathname);
  if (!segments || !isLocale(segments[0])) return pathname;
  const remainder = segments.slice(1).join("/");
  return remainder ? `/${remainder}` : "/";
}

function getRequestLocale(pathname: string): Locale {
  const segments = getPathSegments(pathname);
  const firstSegment = segments?.[0];
  return isLocale(firstSegment) ? firstSegment : routing.defaultLocale;
}

function localizedPath(
  request: NextRequest,
  pathname: string,
  locale: Locale,
): URL {
  const url = request.nextUrl.clone();
  url.pathname = locale === routing.defaultLocale ? pathname : `/${locale}${pathname}`;
  url.search = "";
  return url;
}

function redirectToLogin(request: NextRequest): NextResponse {
  const locale = getRequestLocale(request.nextUrl.pathname);
  const url = localizedPath(request, "/login", locale);
  url.searchParams.set(
    "redirect",
    `${stripLocalePrefix(request.nextUrl.pathname)}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(url);
}

function redirectToDashboard(request: NextRequest): NextResponse {
  const locale = getRequestLocale(request.nextUrl.pathname);
  return NextResponse.redirect(localizedPath(request, "/", locale));
}

function temporaryFailure(): NextResponse {
  return NextResponse.json(
    { error: "Admin access is temporarily unavailable" },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function getAccessToken(request: NextRequest): string | null {
  return request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

function getAuthEndpoint(request: NextRequest): string {
  return new URL(apiUrl("/auth/me"), request.url).toString();
}

async function verifyAdmin(
  request: NextRequest,
  token: string,
): Promise<AdminCheck> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ADMIN_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(getAuthEndpoint(request), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 401) return "unauthenticated";
    if (response.status === 403) return "forbidden";
    if (!response.ok) return "temporary";

    const body: unknown = await response.json();
    if (!body || typeof body !== "object") return "temporary";
    return (body as { role?: unknown }).role === "admin" ? "admin" : "forbidden";
  } catch {
    return "temporary";
  } finally {
    clearTimeout(timeout);
  }
}

const intlMiddleware = createMiddleware(routing);

function redirectUnsupportedLocale(request: NextRequest): NextResponse | null {
  const segments = getPathSegments(request.nextUrl.pathname);
  if (!segments) return null;

  const firstSegment = segments[0];
  if (!firstSegment || firstSegment.length !== 2 || isLocale(firstSegment)) {
    return null;
  }

  const remainder = segments.slice(1);
  const normalizedPath = `/${remainder.join("/")}`;
  const url = request.nextUrl.clone();
  url.pathname =
    routing.defaultLocale === "en"
      ? normalizedPath
      : `/${routing.defaultLocale}${normalizedPath}`;
  url.search = request.nextUrl.search;
  return NextResponse.redirect(url);
}

export default async function middleware(request: NextRequest) {
  const unsupportedLocaleRedirect = redirectUnsupportedLocale(request);
  if (unsupportedLocaleRedirect) return unsupportedLocaleRedirect;

  if (isAdminPath(request.nextUrl.pathname)) {
    const token = getAccessToken(request);
    if (!token) return redirectToLogin(request);

    const check = await verifyAdmin(request, token);
    if (check === "temporary") return temporaryFailure();
    if (check === "forbidden") return redirectToDashboard(request);
    if (check !== "admin") return redirectToLogin(request);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
