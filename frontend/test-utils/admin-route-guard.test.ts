import { isAdminPath } from "@/middleware";

describe("admin route matching", () => {
  it("matches the legacy and localized admin trees", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/users")).toBe(true);
    expect(isAdminPath("/fr/admin/providers")).toBe(true);
    expect(isAdminPath("/es/admin/documents")).toBe(true);
    expect(isAdminPath("/%61dmin")).toBe(true);
    expect(isAdminPath("/fr/%61dmin")).toBe(true);
  });

  it("does not match similarly named paths", () => {
    expect(isAdminPath("/administrator")).toBe(false);
    expect(isAdminPath("/fr/administration/users")).toBe(false);
    expect(isAdminPath("/fr%2Fadmin")).toBe(false);
    expect(isAdminPath("/fr/../admin")).toBe(false);
  });
});
