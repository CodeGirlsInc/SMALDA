import { escapeHtml, sanitizeUrl, sanitizeFilename, sanitizeForDisplay } from "../lib/sanitize";

describe("escapeHtml", () => {
  it("escapes HTML entities", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
    );
  });

  it("escapes ampersands", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#x27;s");
  });

  it("leaves safe strings unchanged", () => {
    expect(escapeHtml("hello world 123")).toBe("hello world 123");
  });
});

describe("sanitizeUrl", () => {
  it("allows http URLs", () => {
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com/");
  });

  it("allows https URLs", () => {
    expect(sanitizeUrl("https://example.com/path")).toBe("https://example.com/path");
  });

  it("allows mailto URLs", () => {
    expect(sanitizeUrl("mailto:user@example.com")).toBe("mailto:user@example.com");
  });

  it("blocks javascript: URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
  });

  it("blocks data: URLs", () => {
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("");
  });

  it("blocks vbscript: URLs", () => {
    expect(sanitizeUrl("vbscript:MsgBox(1)")).toBe("");
  });

  it("returns empty string for invalid URLs", () => {
    expect(sanitizeUrl("not-a-url")).toBe("");
  });
});

describe("sanitizeFilename", () => {
  it("removes special characters", () => {
    expect(sanitizeFilename("my file (1).pdf")).toBe("my_file__1_.pdf");
  });

  it("preserves dots and hyphens", () => {
    expect(sanitizeFilename("doc-v2.pdf")).toBe("doc-v2.pdf");
  });

  it("truncates long filenames", () => {
    const longName = "a".repeat(300);
    expect(sanitizeFilename(longName).length).toBe(255);
  });
});

describe("sanitizeForDisplay", () => {
  it("escapes HTML in strings", () => {
    expect(sanitizeForDisplay("<b>bold</b>")).toBe("&lt;b&gt;bold&lt;/b&gt;");
  });

  it("converts non-strings to strings", () => {
    expect(sanitizeForDisplay(123)).toBe("123");
  });

  it("handles null and undefined", () => {
    expect(sanitizeForDisplay(null)).toBe("");
    expect(sanitizeForDisplay(undefined)).toBe("");
  });

  it("handles event handler injection", () => {
    expect(sanitizeForDisplay('"><img src=x onerror=alert(1)>')).toBe(
      '"&gt;&lt;img src=x onerror=alert(1)&gt;'
    );
  });
});
