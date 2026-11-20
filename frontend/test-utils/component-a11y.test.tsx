import React from "react";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { axe, toHaveNoViolations } from "jest-axe";
import messages from "@/messages/en.json";
import RegisterForm from "@/components/RegisterForm";
import { LoginForm } from "@/app/[locale]/login/LoginForm";
import { FileDisputeModal } from "@/components/disputes/FileDisputeModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

expect.extend(toHaveNoViolations);

jest.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/lib/auth-session", () => ({
  resolvePostLoginPath: () => "/",
  storeSession: jest.fn(),
  saveTwoFactorToken: jest.fn(),
}));

jest.mock("@/lib/api-client", () => ({
  API_V1_BASE: "http://localhost:3001/api/v1",
  ApiError: class ApiError extends Error {},
  apiRequest: jest.fn(),
  request: jest.fn(),
}));

function withIntl(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

// These render the real components (not a fixture), so a regression such as an
// unlabelled input or a dialog without a title fails the accessibility step.
describe("component accessibility (axe)", () => {
  it("LoginForm has no violations", async () => {
    const { container } = render(withIntl(<LoginForm />));
    expect(await axe(container)).toHaveNoViolations();
  });

  it("RegisterForm has no violations", async () => {
    const { container } = render(withIntl(<RegisterForm />));
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Dialog has no violations", async () => {
    const { baseElement } = render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Description</DialogDescription>
          </DialogHeader>
          <button type="button">Close</button>
        </DialogContent>
      </Dialog>,
    );
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("FileDisputeModal has no violations", async () => {
    const { baseElement } = render(
      <FileDisputeModal
        documents={[{ id: "d1", title: "Deed" }]}
        onDisputeFiled={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
