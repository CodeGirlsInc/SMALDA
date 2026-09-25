import React from "react";
import { render, screen } from "@testing-library/react";
import GlobalNotFound from "@/app/not-found";
import LocaleNotFound from "@/app/[locale]/not-found";
import DocumentNotFound from "@/app/(protected)/documents/[id]/not-found";

jest.mock("next-intl/server", () => ({
  getLocale: async () => "fr",
  getTranslations: async () => (key: string) =>
    ({
      description: "The page you are looking for could not be found.",
      home: "Go back home",
      dashboardHome: "Return to dashboard",
      docNotFoundDescription: "The requested document was not found.",
    })[key],
  setRequestLocale: jest.fn(),
}));

jest.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

describe("not-found boundaries", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the root boundary with default-locale copy", () => {
    render(<GlobalNotFound />);

    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
    expect(screen.getByText("The page you are looking for could not be found.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back home" })).toHaveAttribute("href", "/");
  });

  it("renders the locale boundary with translated copy", async () => {
    render(await LocaleNotFound());

    expect(screen.getByText("The page you are looking for could not be found.")).toBeInTheDocument();
    expect(screen.getByText("The requested document was not found.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back home" })).toHaveAttribute("href", "/fr");
  });

  it("uses the dashboard label when a stored session is present", async () => {
    localStorage.setItem("auth-token", "test-token");
    const { container } = render(<GlobalNotFound />);

    expect(
      await screen.findByRole("link", { name: "Return to dashboard" })
    ).toHaveAttribute("href", "/");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(container).not.toHaveTextContent("test-token");
  });

  it("does not expose a dashboard link without a stored session", () => {
    render(<GlobalNotFound />);

    expect(
      screen.queryByRole("link", { name: "Return to dashboard" })
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("keeps the dashboard link on the active locale", async () => {
    localStorage.setItem("auth-token", "test-token");
    render(await LocaleNotFound());

    expect(
      await screen.findByRole("link", { name: "Return to dashboard" })
    ).toHaveAttribute("href", "/fr");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("renders the document boundary with the same branded structure", () => {
    render(<DocumentNotFound />);

    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
    expect(screen.getByText("No record anchored")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  });
});
