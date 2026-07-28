import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import LanguageSwitcher from "@/components/LanguageSwitcher";

// next-intl's navigation helpers rely on the Next.js App Router runtime, which
// isn't available under jsdom — mock them so we can assert on the calls.
const mockReplace = jest.fn();
jest.mock("@/i18n/navigation", () => ({
  usePathname: () => "/settings/security",
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

function renderSwitcher(locale = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LanguageSwitcher />
    </NextIntlClientProvider>
  );
}

function getSelect() {
  return screen.getByRole("combobox", { name: /language/i });
}

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockReplace.mockClear();
    localStorage.clear();
  });

  it("renders all supported languages", () => {
    renderSwitcher();
    expect(getSelect()).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "English" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Français" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Español" })).toBeInTheDocument();
  });

  it("navigates to the same path under the selected locale without a reload", () => {
    renderSwitcher("en");
    fireEvent.change(getSelect(), { target: { value: "fr" } });
    expect(mockReplace).toHaveBeenCalledWith("/settings/security", {
      locale: "fr",
    });
  });

  it("saves the preferred language to the backend when authenticated", async () => {
    localStorage.setItem("auth-token", "test-token");
    const fetchMock = jest.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    renderSwitcher("en");
    fireEvent.change(getSelect(), { target: { value: "es" } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/users/me");
    expect(options).toMatchObject({ method: "PATCH" });
    expect(
      JSON.parse((options as RequestInit).body as string)
    ).toEqual({ preferredLanguage: "es" });
  });

  it("does not call the backend when the user is not authenticated", () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    renderSwitcher("en");
    fireEvent.change(getSelect(), { target: { value: "fr" } });

    expect(fetchMock).not.toHaveBeenCalled();
    // The UI language still switches locally.
    expect(mockReplace).toHaveBeenCalledWith("/settings/security", {
      locale: "fr",
    });
  });
});
