type ApiConfig = typeof import("@/lib/api-config");

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

async function loadConfig(value: string | undefined): Promise<ApiConfig> {
  if (value === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = value;
  jest.resetModules();
  return import("@/lib/api-config");
}

afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  jest.resetModules();
});

describe("NEXT_PUBLIC_API_URL normalization", () => {
  it("uses the versioned base when the env var is an origin", async () => {
    const config = await loadConfig("https://api.example.test");
    expect(config.API_BASE).toBe("https://api.example.test/api/v1");
    expect(config.apiUrl("/users/me")).toBe(
      "https://api.example.test/api/v1/users/me",
    );
    expect(config.getApiOrigin()).toBe("https://api.example.test");
  });

  it("does not duplicate /api from the env var", async () => {
    const config = await loadConfig("https://api.example.test/api/");
    expect(config.API_BASE).toBe("https://api.example.test/api/v1");
    expect(config.apiUrl("/users/me")).toBe(
      "https://api.example.test/api/v1/users/me",
    );
  });

  it("does not duplicate /api/v1 from the env var", async () => {
    const config = await loadConfig("https://api.example.test/api/v1/");
    expect(config.API_BASE).toBe("https://api.example.test/api/v1");
    expect(config.apiUrl("/api/v1/users/me")).toBe(
      "https://api.example.test/api/v1/users/me",
    );
  });

  it("falls back to the local API origin when the env var is empty", async () => {
    const config = await loadConfig("");
    expect(config.API_BASE).toBe("http://localhost:3001/api/v1");
    expect(config.apiUrl("/users/me")).toBe(
      "http://localhost:3001/api/v1/users/me",
    );
  });
});
