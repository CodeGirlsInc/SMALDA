import { render, screen, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import React from "react";

const TestComponent = () => {
  const { user, isAuthenticated, login, logout, isLoading } = useAuth();
  return (
    <div>
      <div data-testid="loading">{isLoading ? "loading" : "ready"}</div>
      <div data-testid="auth-status">{isAuthenticated ? "authenticated" : "guest"}</div>
      <div data-testid="user-name">{user?.name || "none"}</div>
      <button onClick={() => login("admin@smalda.com", "password")}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
};

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it("starts with loading state and then ready", async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    expect(screen.getByTestId("loading")).toHaveTextContent("loading");
    
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    
    expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    expect(screen.getByTestId("auth-status")).toHaveTextContent("guest");
  });

  it("handles login successfully", async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText("Login").click();
    });

    // Wait for the mock API call
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    expect(screen.getByTestId("auth-status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("user-name")).toHaveTextContent("Admin User");
    expect(localStorage.getItem("smalda_access_token")).toBeDefined();
  });

  it("handles logout", async () => {
    // Pre-populate localStorage
    localStorage.setItem("smalda_access_token", "token");
    localStorage.setItem("smalda_user", JSON.stringify({ id: "1", name: "Test" }));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByTestId("auth-status")).toHaveTextContent("authenticated");

    await act(async () => {
      screen.getByText("Logout").click();
    });

    expect(screen.getByTestId("auth-status")).toHaveTextContent("guest");
    expect(localStorage.getItem("smalda_access_token")).toBeNull();
  });

  it("recovers session from localStorage", async () => {
    const mockUser = { id: "1", email: "test@test.com", name: "Saved User", role: "user" };
    localStorage.setItem("smalda_access_token", "saved_token");
    localStorage.setItem("smalda_user", JSON.stringify(mockUser));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByTestId("auth-status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("user-name")).toHaveTextContent("Saved User");
  });
});
