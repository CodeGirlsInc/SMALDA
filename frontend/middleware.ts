import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from "./lib/auth-cookie";
import { LOCALE_COOKIE_NAME, routing, type Locale } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);
const configuredApiBase = process.env.NEXT_PUBLIC_API_URL;
const API_BASE = (
  configuredApiBase ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:3001")
).replace(/\/+$/, "");
const AUTH_ME_PATH = "/api/v1/auth/me";
const AUTH_CHECK_TIMEOUT_MS = 2000;
const PROTECTED_ROOTS = [
  "/",
  "/admin",
  "/2fa/setup",
  "/disputes",
  "/document",
  "/documents",
  "/map",
  "/profile",
  "/reports",
  "/settings",
] as const;

type AuthCheck = "authenticated" | "unauthenticated" | "forbidden" | "unavailable";

function isLocale(value: string | undefined): value is Locale {
  return Boolean(value && routing.locales.includes(value as Locale));
}

function normalizePathSegments(pathname: string): string[] {
  const normalized: string[] = [];
  for (const segment of pathname.split("/")) {
    if (segment && segment !== ".") {
      if (segment === "..") normalized.pop();
      else normalized.push(segment);
    }
  }
  return normalized;
}

function getPathnameWithoutLocale(pathname: string): string {
  const segments = normalizePathSegments(pathname);
  if (segments.length === 0) return "/";
  if (segments[0]?.length === 2) {
    return segments.length > 1 ? `/${segments.slice(1).join("/")}` : "/";
  }
  return `/${segments.join("/")}`;
}

export function isProtectedPath(pathname: string): boolean {
  const routePath = getPathnameWithoutLocale(pathname);
  return PROTECTED_ROOTS.some(
    (root) => routePath === root || routePath.startsWith(`${root}/`),
  );
}

function getFirstSegment(pathname: string): string | undefined {
  return pathname.split("/").filter(Boolean)[0];
}

function getRequestLocale(request: NextRequest): Locale {
  const firstSegment = getFirstSegment(request.nextUrl.pathname);
  if (isLocale(firstSegment)) return firstSegment;

  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const acceptedLocales = request.headers
    .get("accept-language")
    ?.split(",")
    .map((value) => value.trim().split(";")[0]?.split("-")[0]?.toLowerCase());
  const headerLocale = acceptedLocales?.find((value): value is Locale =>
    isLocale(value),
  );
  return headerLocale ?? (routing.defaultLocale as Locale);
}

function isInfrastructurePath(pathname: string): boolean {
  const routePath = getPathnameWithoutLocale(pathname);
  return (
    routePath === "/api" ||
    routePath.startsWith("/api/") ||
    routePath === "/_next" ||
    routePath.startsWith("/_next/") ||
    routePath === "/_vercel" ||
    routePath.startsWith("/_vercel/")
  );
}

function isStaticAssetPath(pathname: string): boolean {
  return pathname.split("/").some((segment) => segment.includes("."));
}

function getUnsupportedLocalePath(pathname: string): string {
  const firstSegment = getFirstSegment(pathname);
  if (!firstSegment) return pathname;
  const remainder = pathname.slice(firstSegment.length + 1);
  return `/${routing.defaultLocale}${remainder}`;
}

function getRedirectPath(request: NextRequest, unsupportedLocale: boolean): string {
  const pathname = unsupportedLocale
    ? getUnsupportedLocalePath(request.nextUrl.pathname)
    : request.nextUrl.pathname;
  return `${pathname}${request.nextUrl.search}`;
}

function createLoginRedirect(
  request: NextRequest,
  redirectPath: string,
): NextResponse {
  const url = request.nextUrl.clone();
  const locale = getRequestLocale(request);
  const firstSegment = getFirstSegment(request.nextUrl.pathname);
  const localePrefix =
    isLocale(firstSegment) || locale !== routing.defaultLocale
      ? `/${locale}`
      : "";
  url.pathname = `${localePrefix}/login`;
  url.search = "";
  url.searchParams.set("redirect", redirectPath);
  return NextResponse.redirect(url);
}

function createSessionRefreshRedirect(
  request: NextRequest,
  redirectPath: string,
): NextResponse {
  const url = request.nextUrl.clone();
  const locale = getRequestLocale(request);
  const firstSegment = getFirstSegment(request.nextUrl.pathname);
  const localePrefix =
    isLocale(firstSegment) || locale !== routing.defaultLocale
      ? `/${locale}`
      : "";
  url.pathname = `${localePrefix}/auth/refresh`;
  url.search = "";
  url.searchParams.set("redirect", redirectPath);
  return NextResponse.redirect(url);
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function createAuthenticationUnavailableResponse(): NextResponse {
  return new NextResponse("Authentication service unavailable", {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

async function verifyAccessToken(token: string): Promise<AuthCheck> {
  if (!API_BASE) return "unavailable";
  if (hasControlCharacter(token)) return "unauthenticated";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${AUTH_ME_PATH}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });

    if (response.status === 401) return "unauthenticated";
    if (response.status === 403) return "forbidden";
    if (response.ok) return "authenticated";
    return "unavailable";
  } catch {
    return "unavailable";
  } finally {
    clearTimeout(timeout);
  }
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (isInfrastructurePath(pathname)) return NextResponse.next();

  const firstSegment = getFirstSegment(pathname);
  const unsupportedLocale = Boolean(
    firstSegment && firstSegment.length === 2 && !isLocale(firstSegment),
  );
  const protectedPath = isProtectedPath(pathname);

  if (protectedPath) {
    const accessToken = request.cookies.get(ACCESS_COOKIE_NAME)?.value?.trim();
    const refreshToken = request.cookies
      .get(REFRESH_COOKIE_NAME)
      ?.value?.trim();
    const redirectPath = getRedirectPath(request, unsupportedLocale);

    if (!accessToken) {
      if (refreshToken && !hasControlCharacter(refreshToken)) {
        return createSessionRefreshRedirect(request, redirectPath);
      }
      return createLoginRedirect(request, redirectPath);
    }

    const authCheck = await verifyAccessToken(accessToken);
    if (authCheck === "unauthenticated") {
      if (refreshToken && !hasControlCharacter(refreshToken)) {
        return createSessionRefreshRedirect(request, redirectPath);
      }
      return createLoginRedirect(request, redirectPath);
    }
    if (authCheck === "forbidden") {
      return createLoginRedirect(request, redirectPath);
    }
    if (authCheck === "unavailable") {
      return createAuthenticationUnavailableResponse();
    }
    if (unsupportedLocale) {
      const url = request.nextUrl.clone();
      url.pathname = getUnsupportedLocalePath(pathname);
      return NextResponse.redirect(url);
    }
  } else if (isStaticAssetPath(pathname)) {
    return NextResponse.next();
  }

  if (unsupportedLocale) {
    const url = request.nextUrl.clone();
    url.pathname = getUnsupportedLocalePath(pathname);
    return NextResponse.redirect(url);
  }

  if (isStaticAssetPath(pathname)) return NextResponse.next();

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel).*)"],
};
