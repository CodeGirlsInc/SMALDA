import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiUrl } from "@/lib/api-config";

const SESSION_COOKIE = "smalda_access_token";
const ADMIN_CHECK_TIMEOUT_MS = 5000;

export interface ServerAdminSession {
  id: string;
  email: string;
  fullName: string;
  role: "admin";
}

type SessionCheck =
  | { kind: "admin"; session: ServerAdminSession }
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function checkAdminSession(): Promise<SessionCheck> {
  let token: string | undefined;
  try {
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE)?.value;
  } catch {
    return { kind: "unavailable" };
  }
  if (!token) return { kind: "unauthenticated" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ADMIN_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(apiUrl("/auth/me"), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 401) return { kind: "unauthenticated" };
    if (response.status === 403) return { kind: "forbidden" };
    if (!response.ok) return { kind: "unavailable" };

    const body: unknown = await response.json();
    if (
      !isRecord(body) ||
      body.role !== "admin" ||
      typeof body.id !== "string" ||
      typeof body.email !== "string" ||
      typeof body.fullName !== "string"
    ) {
      return { kind: "unavailable" };
    }

    return {
      kind: "admin",
      session: {
        id: body.id,
        email: body.email,
        fullName: body.fullName,
        role: "admin",
      },
    };
  } catch {
    return { kind: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function requireAdminSession(locale: string): Promise<ServerAdminSession> {
  const result = await checkAdminSession();

  if (result.kind === "admin") return result.session;

  if (result.kind === "unauthenticated") {
    const loginPath = locale === "en" ? "/login" : `/${locale}/login`;
    redirect(`${loginPath}?redirect=${encodeURIComponent("/admin")}`);
  }

  if (result.kind === "forbidden") {
    redirect(locale === "en" ? "/" : `/${locale}/`);
  }

  redirect("/api/admin-unavailable");
}
