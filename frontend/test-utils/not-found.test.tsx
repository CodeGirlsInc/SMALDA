import React from "react";
import { render, screen } from "@testing-library/react";
import GlobalNotFound from "@/app/not-found";
import LocaleNotFound from "@/app/[locale]/not-found";
import DocumentNotFound from "@/app/(protected)/documents/[id]/not-found";

jest.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) =>
    ({
      description: "The page you are looking for could not be found.",
      home: "Go back home",
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
  it("renders the root boundary with default-locale copy", () => {
    render(<GlobalNotFound />);

    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
    expect(screen.getByText("The page you are looking for could not be found.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back home" })).toHaveAttribute("href", "/");
  });

  it("renders the locale boundary with translated copy", async () => {
    render(await LocaleNotFound({ params: Promise.resolve({ locale: "fr" }) }));

    expect(screen.getByText("The page you are looking for could not be found.")).toBeInTheDocument();
    expect(screen.getByText("The requested document was not found.")).toBeInTheDocument();
  });

  it("renders the document boundary with the same branded structure", () => {
    render(<DocumentNotFound />);

    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
    expect(screen.getByText("No record anchored")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  });
});
