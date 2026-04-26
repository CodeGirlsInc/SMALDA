"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type FieldErrors = {
  email?: string;
  password?: string;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    const next: FieldErrors = {};
    if (!email.trim()) {
      next.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Enter a valid email address.";
    }
    if (!password) {
      next.password = "Password is required.";
    } else if (password.length < 8) {
      next.password = "Password must be at least 8 characters.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Email/password submit ───────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError("");
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setApiError(data.message ?? "Invalid email or password. Please try again.");
        return;
      }

      router.push("/dashboard");
    } catch {
      setApiError("Something went wrong. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── OAuth ───────────────────────────────────────────────────────────────────
  function handleOAuth(provider: "google" | "github") {
    window.location.href = `/api/auth/${provider}`;
  }

  return (
    <main className="min-h-screen bg-[#F5F3EE] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Logo / wordmark */}
        <div className="mb-10 text-center">
          <span className="inline-block text-[11px] font-semibold tracking-[0.25em] text-stone-400 uppercase mb-3">
            Smart Land Document Analysis
          </span>
          <h1
            className="text-4xl font-bold tracking-tight text-stone-900"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            SMALDA
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-8 py-9">

          <h2 className="text-lg font-semibold text-stone-900 mb-1">Sign in</h2>
          <p className="text-sm text-stone-500 mb-7">
            Access your land document workspace.
          </p>

          {/* API error */}
          {apiError && (
            <div
              role="alert"
              className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {apiError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-stone-700 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                }}
                placeholder="you@example.com"
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-stone-900 placeholder-stone-400
                  outline-none transition
                  focus:ring-2 focus:ring-stone-900 focus:border-transparent
                  ${errors.email
                    ? "border-red-400 bg-red-50 focus:ring-red-400"
                    : "border-stone-200 bg-stone-50 hover:border-stone-300"
                  }`}
                aria-describedby={errors.email ? "email-error" : undefined}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p id="email-error" className="mt-1.5 text-xs text-red-600">
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-stone-700"
                >
                  Password
                </label>
                <a
                  href="/forgot-password"
                  className="text-xs text-stone-500 hover:text-stone-800 transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                }}
                placeholder="••••••••"
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-stone-900 placeholder-stone-400
                  outline-none transition
                  focus:ring-2 focus:ring-stone-900 focus:border-transparent
                  ${errors.password
                    ? "border-red-400 bg-red-50 focus:ring-red-400"
                    : "border-stone-200 bg-stone-50 hover:border-stone-300"
                  }`}
                aria-describedby={errors.password ? "password-error" : undefined}
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <p id="password-error" className="mt-1.5 text-xs text-red-600">
                  {errors.password}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-stone-900 text-white text-sm font-medium py-2.5
                hover:bg-stone-800 active:bg-stone-950 transition-colors
                disabled:opacity-60 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-stone-400">or continue with</span>
            </div>
          </div>

          {/* OAuth buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              className="flex items-center justify-center gap-2 rounded-lg border border-stone-200
                bg-white py-2.5 text-sm font-medium text-stone-700
                hover:bg-stone-50 hover:border-stone-300 active:bg-stone-100
                transition-colors"
            >
              {/* Google icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </button>

            <button
              type="button"
              onClick={() => handleOAuth("github")}
              className="flex items-center justify-center gap-2 rounded-lg border border-stone-200
                bg-white py-2.5 text-sm font-medium text-stone-700
                hover:bg-stone-50 hover:border-stone-300 active:bg-stone-100
                transition-colors"
            >
              {/* GitHub icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483
                  0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608
                  1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338
                  -2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65
                  0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337
                  1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688
                  0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747
                  0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </button>
          </div>

          {/* Sign up link */}
          <p className="mt-7 text-center text-sm text-stone-500">
            Don&rsquo;t have an account?{" "}
            <a
              href="/register"
              className="font-medium text-stone-900 hover:underline transition-colors"
            >
              Create one
            </a>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-stone-400">
          &copy; {new Date().getFullYear()} SMALDA &mdash; Secure land document analysis.
        </p>
      </div>
    </main>
  );
}
