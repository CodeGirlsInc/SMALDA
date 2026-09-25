import React from "react";
import { NextIntlClientProvider } from "next-intl";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import messages from "@/messages/en.json";
import RegisterForm, { getPasswordStrength } from "@/components/RegisterForm";

const mockReplace = jest.fn();
const mockApiRequest = jest.fn();
const mockStoreSession = jest.fn();

jest.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/lib/auth-session", () => ({
  storeSession: (...args: unknown[]) => mockStoreSession(...args),
}));

jest.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {
    status: number | null;

    constructor({ status }: { status: number | null }) {
      super("api error");
      this.status = status;
    }
  },
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

function renderRegisterForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RegisterForm />
    </NextIntlClientProvider>,
  );
}

function fillValidForm(confirmPassword = "V7!qL9#mZ2@pR4") {
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: "Ada Lovelace" },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "ada@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "V7!qL9#mZ2@pR4" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: confirmPassword },
  });
}

describe("RegisterForm", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockApiRequest.mockReset();
    mockStoreSession.mockClear();
  });

  it("validates a password mismatch before making a request", async () => {
    renderRegisterForm();
    fillValidForm("Different1!");

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it("updates the password strength indicator while typing", () => {
    renderRegisterForm();
    const password = screen.getByLabelText("Password");

    fireEvent.change(password, { target: { value: "abc" } });
    expect(screen.getByRole("progressbar", { name: "Password strength" })).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    expect(screen.getByText("Weak")).toBeInTheDocument();

    fireEvent.change(password, { target: { value: "V7!qL9#mZ2@pR4" } });
    expect(screen.getByRole("progressbar", { name: "Password strength" })).toHaveAttribute(
      "aria-valuenow",
      "6",
    );
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });

  it("submits only registration fields and redirects after success", async () => {
    mockApiRequest.mockResolvedValue({
      access_token: "token",
      refresh_token: "refresh-token",
    });
    renderRegisterForm();
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));
    expect(mockApiRequest).toHaveBeenCalledWith(
      "/api/v1/auth/register",
      expect.objectContaining({
        method: "POST",
        anonymous: true,
        body: {
          fullName: "Ada Lovelace",
          email: "ada@example.com",
          password: "V7!qL9#mZ2@pR4",
        },
      }),
    );
    expect(mockStoreSession).toHaveBeenCalledWith({
      access_token: "token",
      refresh_token: "refresh-token",
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
  });

  it("does not call a short rule-satisfying password strong", () => {
    expect(getPasswordStrength("Abcdef1!")).toMatchObject({
      label: "Weak",
      meetsRequirements: true,
    });
    expect(getPasswordStrength("V7!qL9#mZ2@pR4")).toMatchObject({
      label: "Strong",
      score: 6,
      meetsRequirements: true,
    });
  });
});
