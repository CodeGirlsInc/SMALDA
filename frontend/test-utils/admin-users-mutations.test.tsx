import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminUsersPage from "@/app/[locale]/(protected)/admin/users/page";

const mockRequest = jest.fn();
const mockRequestRaw = jest.fn();

jest.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {},
  getApiUrl: (path: string) => `http://localhost:3001/api/v1/${path}`,
  request: (...args: unknown[]) => mockRequest(...args),
  requestRaw: (...args: unknown[]) => mockRequestRaw(...args),
}));

jest.mock("@/lib/auth-session", () => ({
  clearSession: jest.fn(),
  getJwtClaims: () => ({ role: "admin", sub: "admin-1" }),
  getValidAccessToken: () => "admin-access-token",
}));

const users = [
  {
    id: "user-1",
    fullName: "Alice Example",
    email: "alice@example.com",
    role: "user",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastLoginAt: null,
    status: "active",
  },
  {
    id: "user-2",
    fullName: "Bob Example",
    email: "bob@example.com",
    role: "user",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastLoginAt: null,
    status: "active",
  },
];

function renderPage() {
  return render(<AdminUsersPage />);
}

async function selectAliceForDeletion() {
  fireEvent.click(await screen.findByRole("checkbox", { name: "Select Alice Example" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete 1 selected" }));
}

describe("AdminUsersPage bulk deletion", () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockRequestRaw.mockReset();
    mockRequest.mockResolvedValue({
      data: users,
      total: users.length,
      page: 1,
      pageSize: 20,
    });
    jest.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps selected users when a managed deletion fails", async () => {
    mockRequestRaw.mockRejectedValue(new Error("delete failed"));
    renderPage();

    await selectAliceForDeletion();

    await waitFor(() => expect(mockRequestRaw).toHaveBeenCalledTimes(1));
    expect(mockRequestRaw).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/users/user-1",
      { method: "DELETE" },
    );
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("delete failed");
  });

  it("removes selected users only after all managed deletions succeed", async () => {
    mockRequestRaw.mockResolvedValue({} as Response);
    renderPage();

    await selectAliceForDeletion();

    await waitFor(() =>
      expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
  });
});
