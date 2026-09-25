"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { hasStoredSession } from "@/lib/auth-session";

interface NotFoundContentProps {
  description: string;
  homeLabel: string;
  homeHref?: string;
  detailDescription?: string;
  dashboardLabel?: string;
  dashboardHref?: string;
}

export function NotFoundContent({
  description,
  homeLabel,
  homeHref = "/",
  detailDescription,
  dashboardLabel = "Return to dashboard",
  dashboardHref,
}: NotFoundContentProps) {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const updateSession = () => setHasSession(hasStoredSession());
    updateSession();
    window.addEventListener("storage", updateSession);
    return () => window.removeEventListener("storage", updateSession);
  }, []);

  const resolvedDashboardHref = dashboardHref ?? homeHref;
  const linkHref =
    hasSession && dashboardLabel ? resolvedDashboardHref : homeHref;
  const linkLabel = hasSession && dashboardLabel ? dashboardLabel : homeLabel;

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="text-sm text-gray-500">{description}</p>
      <Link
        href={linkHref}
        className="text-sm font-medium text-blue-600 underline hover:text-blue-800"
      >
        {linkLabel}
      </Link>
      {detailDescription ? (
        <p className="mt-6 max-w-md text-xs text-gray-400">{detailDescription}</p>
      ) : null}
    </main>
  );
}
