import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

const testMessages = {
  common: {
    appName: "SMALDA",
    loading: "Loading…",
    save: "Save",
    cancel: "Cancel",
    previous: "Previous",
    next: "Next",
  },
  nav: {
    dashboard: "Dashboard",
    documents: "Documents",
    users: "Users",
    settings: "Settings",
    signOut: "Sign out",
  },
  errors: {
    title: "Something went wrong",
    description: "An unexpected error occurred.",
    tryAgain: "Try again",
    goHome: "Go back home",
  },
  auth: {
    login: {
      title: "Sign in to SMALDA",
      submit: "Sign in",
      submitting: "Signing in…",
    },
  },
  dashboard: {
    title: "Dashboard",
    welcome: "Welcome back",
    subtitle: "Here's an overview.",
    stats: { total: "Total", verified: "Verified", flagged: "Flagged", pending: "Pending" },
  },
};

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  locale?: string;
}

function AllProviders({ children, locale = "en" }: { children: React.ReactNode; locale?: string }) {
  return (
    <NextIntlClientProvider locale={locale} messages={testMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

export function renderWithProviders(ui: ReactElement, options: CustomRenderOptions = {}) {
  const { locale, ...renderOptions } = options;
  return render(ui, {
    wrapper: ({ children }) => <AllProviders locale={locale}>{children}</AllProviders>,
    ...renderOptions,
  });
}

export { testMessages };
