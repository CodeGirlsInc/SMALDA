import {
  DEFAULT_POST_LOGIN_PATH,
  resolvePostLoginPath,
} from "@/lib/auth-session";

describe("post-login paths", () => {
  it("uses the default route when no safe destination is provided", () => {
    expect(DEFAULT_POST_LOGIN_PATH).toBe("/");
    expect(resolvePostLoginPath(null)).toBe("/");
    expect(resolvePostLoginPath("https://evil.example")).toBe("/");
  });

  it("removes repeated locale prefixes before locale-aware navigation", () => {
    expect(resolvePostLoginPath("/fr/admin/users")).toBe("/admin/users");
    expect(resolvePostLoginPath("/fr/fr/admin/users")).toBe("/admin/users");
    expect(resolvePostLoginPath("/fr")).toBe("/");
  });
});
