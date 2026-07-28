const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};

const ESCAPE_REGEX = /[&<>"']/g;

export function escapeHtml(input: string): string {
  return input.replace(ESCAPE_REGEX, (char) => ESCAPE_MAP[char] || char);
}

const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!SAFE_SCHEMES.has(parsed.protocol)) {
      return "";
    }
    return parsed.href;
  } catch {
    return "";
  }
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 255);
}

export function sanitizeForDisplay(input: unknown): string {
  if (typeof input !== "string") {
    return String(input ?? "");
  }
  return escapeHtml(input);
}
