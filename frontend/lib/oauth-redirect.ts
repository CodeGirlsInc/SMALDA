const OAUTH_REDIRECT_COOKIE_NAME = "oauth_redirect";
const OAUTH_REDIRECT_MAX_AGE = 600;

export function persistOAuthRedirect(path: string): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${OAUTH_REDIRECT_COOKIE_NAME}=${encodeURIComponent(path)}; Path=/; Max-Age=${OAUTH_REDIRECT_MAX_AGE}; SameSite=Lax${secure}`;
}

export function consumeOAuthRedirect(): string | null {
  if (typeof document === "undefined") return null;

  const prefix = `${OAUTH_REDIRECT_COOKIE_NAME}=`;
  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${OAUTH_REDIRECT_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;

  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
