import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { http, HttpResponse } from "msw";

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

/**
 * Mock helpers for the Stellar verification API
 * 
 * The verification API endpoint is GET /verify/:hash
 * It returns:
 * - { verified: true, stellarTxHash, stellarLedger, anchoredAt, documentStatus } for verified documents
 * - { verified: false, message: 'Document not found', documentStatus: null } for unknown hashes
 * - { verified: false, message: 'Document has not been verified on Stellar', documentStatus } for unverified documents
 * 
 * Usage in tests:
 * 
 * import { verificationApiHandlers, createVerificationResponse } from '@/test-utils/test-utils';
 * 
 * // Add to your test's MSW handlers
 * handlers: [...verificationApiHandlers]
 * 
 * // Or create custom responses
 * const handlers = [
 *   http.get('/verify/:hash', ({ params }) => {
 *     const hash = params.hash as string;
 *     return HttpResponse.json(createVerificationResponse(hash, { verified: true }));
 *   })
 * ];
 */

export const verificationApiHandlers = [
  http.get(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/verify/:hash`, ({ params }) => {
    const hash = params.hash as string;
    
    // Default: return not found for unknown hashes
    return HttpResponse.json({
      verified: false,
      message: 'Document not found',
      documentStatus: null,
    });
  }),
];

export function createVerificationResponse(
  hash: string,
  options: {
    verified?: boolean;
    documentStatus?: string | null;
    stellarTxHash?: string;
    stellarLedger?: number;
    anchoredAt?: string;
  } = {}
) {
  const { verified = false, documentStatus = null, stellarTxHash, stellarLedger, anchoredAt } = options;
  
  if (!verified) {
    return {
      verified: false,
      message: documentStatus ? 'Document has not been verified on Stellar' : 'Document not found',
      documentStatus,
    };
  }
  
  return {
    verified: true,
    stellarTxHash: stellarTxHash ?? `tx_${hash.slice(0, 16)}`,
    stellarLedger: stellarLedger ?? 12345678,
    anchoredAt: anchoredAt ?? new Date().toISOString(),
    documentStatus,
  };
}

export { testMessages };
