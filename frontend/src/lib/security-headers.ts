/**
 * Content-Security-Policy builder (#1515).
 *
 * The previous CSP allowed `unsafe-inline`, `unsafe-eval` and connected to any
 * `http(s):` origin. This builder produces a strict policy and lets callers add
 * only the explicit sources they need.
 */
export interface CspOptions {
  nonce?: string;
  isDevelopment?: boolean;
  connectSources?: string[];
  scriptSources?: string[];
  styleSources?: string[];
  imageSources?: string[];
  allowInlineStyles?: boolean;
}

export function buildContentSecurityPolicy(options: CspOptions = {}): string {
  const nonce = options.nonce ? `'nonce-${options.nonce}'` : null;
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      ...(nonce ? [nonce] : []),
      "'strict-dynamic'",
      ...(options.isDevelopment ? ["'unsafe-eval'"] : []),
      ...(options.scriptSources ?? []),
    ],
    "style-src": [
      "'self'",
      ...(nonce ? [nonce] : []),
      ...(options.allowInlineStyles ? ["'unsafe-inline'"] : []),
      ...(options.styleSources ?? []),
    ],
    "img-src": ["'self'", "data:", ...(options.imageSources ?? [])],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(options.connectSources ?? [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  return Object.entries(directives)
    .map(([directive, values]) => `${directive} ${[...new Set(values)].join(" ")}`)
    .join("; ");
}
