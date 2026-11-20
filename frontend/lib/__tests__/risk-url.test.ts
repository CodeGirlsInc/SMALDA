import { riskUrl } from "../risk-url";

describe("riskUrl", () => {
  it.each(["en", "fr", "es"])("sends the %s locale as ?lang=", (locale) => {
    const url = riskUrl("/documents/abc", locale);
    expect(url).toContain("/documents/abc/risk");
    expect(new URL(url).searchParams.get("lang")).toBe(locale);
  });
});
