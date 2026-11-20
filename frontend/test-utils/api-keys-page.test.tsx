import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import ApiKeysPage from "@/app/[locale]/(protected)/settings/api-keys/page";

const mockRequest = jest.fn();

jest.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {
    backendMessage?: string;
  },
  request: (...args: unknown[]) => mockRequest(...args),
}));

describe("ApiKeysPage", () => {
  beforeEach(() => mockRequest.mockReset());

  it("lists keys without rendering hashes or owner ids", async () => {
    mockRequest.mockResolvedValue([
      {
        id: "k1",
        name: "CI key",
        prefix: "smalda_abcdef",
        keyHash: "SECRET-HASH-VALUE",
        userId: "user-123",
        scopes: ["verify"],
        lastUsedAt: null,
        expiresAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const { container } = render(<ApiKeysPage />);

    await waitFor(() => expect(screen.getByText("CI key")).toBeInTheDocument());
    expect(screen.getByText("smalda_abcdef")).toBeInTheDocument();
    expect(screen.getByText("verify")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("SECRET-HASH-VALUE");
    expect(container.innerHTML).not.toContain("user-123");
    expect(String(mockRequest.mock.calls[0][0])).toContain("/users/me/api-keys");
  });
});
