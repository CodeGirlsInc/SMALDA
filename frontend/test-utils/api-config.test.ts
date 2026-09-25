import {
  apiUrl,
  normalizeConfiguredBase,
  normalizeResourcePath,
} from "@/lib/api-config";

describe("api configuration", () => {
  it("adds one versioned prefix to an origin", () => {
    expect(normalizeConfiguredBase("https://api.example.test")).toBe(
      "https://api.example.test/api/v1",
    );
  });

  it("does not duplicate a versioned path already present in the environment", () => {
    expect(normalizeConfiguredBase("https://api.example.test/api/v1")).toBe(
      "https://api.example.test/api/v1",
    );
    expect(normalizeConfiguredBase("https://api.example.test/api")).toBe(
      "https://api.example.test/api/v1",
    );
  });

  it("normalizes legacy API resource paths", () => {
    expect(normalizeResourcePath("/api/v1/documents")).toBe("/documents");
    expect(normalizeResourcePath("/api/documents")).toBe("/documents");
    expect(apiUrl("/api/v1/documents", { page: 1 })).toContain(
      "/api/v1/documents?page=1",
    );
  });
});
