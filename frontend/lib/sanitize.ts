/**
 * Sanitizers for scalar values rendered by the UI. `sanitizeText` is for
 * text-only contexts, and `isSafeUrl` is for link targets. Neither function
 * parses or sanitizes HTML or SVG markup.
 */

export function sanitizeText(input: string): string {
  if (!input) return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Returns true for HTTP(S), mailto, and relative inputs resolved against localhost.
 */
export function isSafeUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, "http://localhost");
    return ["http:", "https:", "mailto:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
