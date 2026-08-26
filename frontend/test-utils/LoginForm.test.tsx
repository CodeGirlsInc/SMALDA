import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import { LoginForm } from "@/app/[locale]/login/LoginForm";
import { ApiError } from "@/lib/api-client";

const mockReplace = jest.fn();
const mockSearchParams = new URLSearchParams();
const mockApiRequest = jest.fn();
const mockStoreSession = jest.fn();

jest.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {
    status: number | null;
    messageKey: string;

    constructor({ status, messageKey }: { status: number | null; messageKey: string }) {
      super(messageKey);
      this.status = status;
      this.messageKey = messageKey;
    }
  },
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

jest.mock("@/lib/auth-session", () => ({
  resolvePostLoginPath: () => "/dashboard",
  storeSession: (...args: unknown[]) => mockStoreSession(...args),
}));

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LoginForm />
    </NextIntlClientProvider>,
  );
}

describe("LoginForm", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockApiRequest.mockReset();
    mockStoreSession.mockClear();
    mockSearchParams.delete("redirect");
    mockSearchParams.delete("reset");
  });

  it("renders both OAuth links with the provider endpoints", () => {
    renderForm();

    expect(screen.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
      "href",
      "http://localhost:3001/api/auth/google",
    );
    expect(screen.getByRole("link", { name: "Continue with GitHub" })).toHaveAttribute(
      "href",
      "http://localhost:3001/api/auth/github",
    );
  });

  it("shows validation messages without submitting invalid credentials", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(await screen.findByText("Enter your password.")).toBeInTheDocument();
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it("submits credentials, stores the session, and redirects on success", async () => {
    mockApiRequest.mockResolvedValue({ access_token: "access-token" });
    renderForm();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "person@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));
    expect(mockApiRequest).toHaveBeenCalledWith(
      "http://localhost:3001/api/auth/login",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(mockStoreSession).toHaveBeenCalledWith({ access_token: "access-token" });
    expect(mockReplace).toHaveBeenCalledWith("/dashboard");
  });

  it("disables submission and shows the loading label while the request is pending", async () => {
    let resolveRequest!: (value: unknown) => void;
    mockApiRequest.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    renderForm();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "person@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("button", { name: "Signing in…" })).toBeDisabled();
    resolveRequest({ access_token: "access-token" });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
  });

  it("renders an inline error when credentials are rejected", async () => {
    mockApiRequest.mockRejectedValue(
      new ApiError({ status: 401, messageKey: "errors.status.unauthorized" }),
    );
    renderForm();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "person@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
  });
});
