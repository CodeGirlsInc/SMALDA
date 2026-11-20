/**
 * Trusted-proxy-aware client IP resolution (#1489).
 *
 * The client IP was read straight from `X-Forwarded-For`, which is spoofable
 * unless the app is explicitly configured behind a trusted proxy. This helper
 * only honours the header when the caller opts in, and otherwise falls back to
 * the socket address.
 */
export interface ClientIpOptions {
  trustProxy: boolean;
}

export function getClientIp(
  headers: Record<string, string | string[] | undefined>,
  socketAddress: string | undefined,
  options: ClientIpOptions = { trustProxy: false },
): string | null {
  if (options.trustProxy) {
    const forwarded = headers["x-forwarded-for"];
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (value) {
      const first = value.split(",")[0]?.trim();
      if (first) {
        return first;
      }
    }
  }
  return socketAddress ?? null;
}
