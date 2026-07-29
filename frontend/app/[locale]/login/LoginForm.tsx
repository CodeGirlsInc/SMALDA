"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";
import { ApiError, apiRequest } from "@/lib/api-client";
import {
  resolvePostLoginPath,
  storeSession,
  type LoginResponse,
} from "@/lib/auth-session";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function ResetSuccessToast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 rounded-xl bg-green-600 px-5 py-3 text-sm font-medium text-white shadow-lg"
    >
      {message}
    </div>
  );
}

/**
 * A failed sign-in splits into two cases the user needs to tell apart:
 * `credentials` is a 401 and means the email/password pair was wrong, so it is
 * rendered inline against the form. Everything else (network, 5xx, rate limit)
 * is not the user's fault and gets the shared ErrorBanner, which resolves the
 * api-client's `errors.status.*` key and offers a retry.
 */
type SubmitError =
  | { kind: "credentials" }
  | { kind: "api"; messageKey: string };

export function LoginForm() {
  const t = useTranslations("auth.login");
  // Field-level messages arrive from the zod schema as full key paths
  // (`errors.email.invalid`), so they resolve against the message root.
  const tKey = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [showResetToast, setShowResetToast] = useState(false);

  useEffect(() => {
    if (searchParams.get("reset") === "success") {
      setShowResetToast(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("reset");
      window.history.replaceState({}, "", url.toString());
    }
    // Only relevant on first render of the redirect from /reset-password.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
    defaultValues: { email: "", password: "" },
  });

  const target = resolvePostLoginPath(searchParams.get("redirect"));

  // OAuth is a full-page handoff to the backend, which redirects back with a
  // token — so these are plain anchors, not locale-aware client-side links.
  const oauthHref = (provider: "google" | "github") =>
    `${API_BASE}/api/auth/${provider}`;

  async function onSubmit(values: LoginInput) {
    setSubmitError(null);
    try {
      const data = await apiRequest<LoginResponse>(
        `${API_BASE}/api/auth/login`,
        {
          method: "POST",
          body: values,
          // Lets the backend set a session cookie too, for when the token
          // stops living in localStorage.
          credentials: "include",
        },
      );
      storeSession(data);
      // replace, so Back does not land the user on a login page they have
      // already passed through.
      router.replace(target);
    } catch (err) {
      if (err instanceof ApiError) {
        // 401 here means "wrong email or password", not the api-client's
        // generic "your session expired" reading of the same status.
        setSubmitError(
          err.status === 401
            ? { kind: "credentials" }
            : { kind: "api", messageKey: err.messageKey },
        );
        return;
      }
      setSubmitError({ kind: "api", messageKey: "errors.status.unknown" });
    }
  }

  const credentialsRejected = submitError?.kind === "credentials";

  return (
    <Card variant="elevated" className="w-full max-w-sm">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {submitError?.kind === "api" ? (
          <ErrorBanner
            messageKey={submitError.messageKey}
            onRetry={handleSubmit(onSubmit)}
          />
        ) : null}

        <form
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              {t("emailLabel")}
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              variant={errors.email || credentialsRejected ? "error" : "default"}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
            {errors.email?.message ? (
              <p id="email-error" className="text-xs text-destructive">
                {tKey(errors.email.message)}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">
                {t("passwordLabel")}
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                {t("forgotPassword")}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder={t("passwordPlaceholder")}
              variant={
                errors.password || credentialsRejected ? "error" : "default"
              }
              aria-describedby={
                errors.password ? "password-error" : undefined
              }
              {...register("password")}
            />
            {errors.password?.message ? (
              <p id="password-error" className="text-xs text-destructive">
                {tKey(errors.password.message)}
              </p>
            ) : null}
          </div>

          {credentialsRejected ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {t("errorInvalid")}
            </p>
          ) : null}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? t("submitting") : t("submit")}
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase text-muted-foreground">
            {t("dividerOr")}
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-2">
          <Button asChild variant="outline" className="w-full">
            <a href={oauthHref("google")}>{t("continueWithGoogle")}</a>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href={oauthHref("github")}>{t("continueWithGithub")}</a>
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("signUp")}
          </Link>
        </p>
      </CardContent>

      {showResetToast && (
        <ResetSuccessToast message={t("resetSuccessToast")} />
      )}
    </Card>
  );
}
