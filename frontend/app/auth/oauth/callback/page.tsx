"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api-client";
import { storeSession, type LoginResponse } from "@/lib/auth-session";

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError("The sign-in exchange code is missing.");
      return;
    }

    let active = true;
    window.history.replaceState({}, "", window.location.pathname);

    void apiRequest<LoginResponse>("/auth/oauth/exchange", {
      method: "POST",
      anonymous: true,
      credentials: "include",
      body: { code },
    })
      .then((tokens) => {
        if (!active) return;
        storeSession(tokens);
        router.replace("/");
      })
      .catch(() => {
        if (!active) return;
        setError("The sign-in exchange expired. Please try again.");
      });

    return () => {
      active = false;
    };
  }, [code, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Completing sign in</h1>
        {error ? (
          <>
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
            <Link href="/login" className="mt-5 inline-block text-sm text-blue-600 underline">
              Return to login
            </Link>
          </>
        ) : (
          <p className="mt-3 text-sm text-gray-500" role="status">
            Establishing your session…
          </p>
        )}
      </div>
    </main>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-4 py-12">
          <p className="text-sm text-gray-500" role="status">
            Completing sign in…
          </p>
        </main>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
