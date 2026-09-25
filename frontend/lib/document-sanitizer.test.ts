import { sanitizeSvg } from "./document-sanitizer";

describe("sanitizeSvg", () => {
  it("removes active content and unsafe external references", () => {
    const sanitized = sanitizeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
        <script>alert(1)</script>
        <foreignObject><div xmlns="http://www.w3.org/1999/xhtml">html</div></foreignObject>
        <animate attributeName="href" values="javascript:alert(1)" />
        <rect width="10" height="10" onclick="alert(1)" fill="url(https://attacker.example/paint)" />
        <rect width="10" height="10" fill="u\\72l(https://attacker.example/paint)" />
        <image href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" />
        <a href="javascript:alert(1)">link</a>
      </svg>
    `);

    expect(sanitized).toContain("<rect");
    expect(sanitized).not.toMatch(
      /script|foreignObject|animate|onload|onclick|javascript:|data:|attacker\.example/i,
    );
  });

  it("preserves ordinary SVG attributes, local references, and CSS URLs", () => {
    const sanitized = sanitizeSvg(`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="120"
        height="40"
        viewBox="0 0 120 40"
        preserveAspectRatio="xMidYMid meet"
        aria-labelledby="title"
      >
        <title id="title">Parcel A &amp; B</title>
        <defs>
          <linearGradient id="paint">
            <stop offset="0" stop-color="#ffffff" />
          </linearGradient>
        </defs>
        <path id="shape" d="M0 0 L120 40" fill="url(#paint)" stroke="#123456" stroke-width="2" />
        <text aria-label="https://maps.example/Parcel"><textPath href="#shape">Parcel A</textPath></text>
        <text aria-label="url(https://maps.example/reference)" data-reference="url(https://maps.example/data)">Reference text</text>
      </svg>
    `);

    expect(sanitized).toContain('viewBox="0 0 120 40"');
    expect(sanitized).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(sanitized).toContain('d="M0 0 L120 40"');
    expect(sanitized).toContain('fill="url(#paint)"');
    expect(sanitized).toContain('stroke="#123456"');
    expect(sanitized).toContain('href="#shape"');
    expect(sanitized).toContain('aria-label="https://maps.example/Parcel"');
    expect(sanitized).toContain(
      'aria-label="url(https://maps.example/reference)"',
    );
    expect(sanitized).toContain(
      'data-reference="url(https://maps.example/data)"',
    );
  });

  it("rejects DTD and external entity declarations", () => {
    expect(() =>
      sanitizeSvg(`
        <!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
        <svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>
      `),
    ).toThrow("Unsafe SVG declaration");
  });

  it("serializes predefined XML entities without custom expansion", () => {
    const sanitized = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><text>A &amp; B</text></svg>',
    );

    expect(sanitized).toContain("A &amp; B");
    expect(sanitized).not.toContain("A & B");
  });

  it("rejects non-SVG XML roots", () => {
    expect(() =>
      sanitizeSvg('<html xmlns="http://www.w3.org/1999/xhtml"></html>'),
    ).toThrow("Invalid SVG document");
  });
});
