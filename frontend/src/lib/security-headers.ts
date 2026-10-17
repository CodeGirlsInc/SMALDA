/**
 * Content-Security-Policy builder (#1515).
 *
 * The previous CSP allowed `unsafe-inline`, `unsafe-eval` and connected to any
 * `http(s):` origin. This builder produces a strict policy and lets callers add
 * only the explicit sources they need.
 */
export interface CspOptions {
  connectSources?: string[];
  scriptSources?: string[];
  styleSources?: string[];
  imageSources?: string[];
  allowInlineStyles?: boolean;
}

export function buildContentSecurityPolicy(options: CspOptions = {}): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", ...(options.scriptSources ?? [])],
    "style-src": [
      "'self'",
      ...(options.allowInlineStyles ? ["'unsafe-inline'"] : []),
      ...(options.styleSources ?? []),
    ],
    "img-src": ["'self'", "data:", ...(options.imageSources ?? [])],
    "connect-src": ["'self'", ...(options.connectSources ?? [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  return Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");
}
