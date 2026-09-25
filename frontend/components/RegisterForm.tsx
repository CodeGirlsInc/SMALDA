"use client";

import { useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { ApiError, apiRequest } from "@/lib/api-client";
import { storeSession, type LoginResponse } from "@/lib/auth-session";
import {
  registerSchema,
  type RegisterFormValues,
} from "@/app/schemas/register.schema";
import { Link, useRouter } from "@/i18n/navigation";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Input,
} from "@/components/ui";

const PASSWORD_REQUIREMENTS = [
  { id: "length", met: (password: string) => password.length >= 8 },
  { id: "uppercase", met: (password: string) => /[A-Z]/.test(password) },
  { id: "lowercase", met: (password: string) => /[a-z]/.test(password) },
  { id: "number", met: (password: string) => /[0-9]/.test(password) },
  { id: "special", met: (password: string) => /[^A-Za-z0-9]/.test(password) },
] as const;

const COMMON_PASSWORDS = new Set([
  "abc123!",
  "admin123!",
  "iloveyou1!",
  "letmein1!",
  "password1!",
  "qwerty123!",
  "welcome1!",
]);

const SEQUENTIAL_RUNS = [
  "0123",
  "1234",
  "2345",
  "3456",
  "4567",
  "5678",
  "6789",
  "abcd",
  "bcde",
  "cdef",
  "defg",
  "qwer",
  "wert",
  "erty",
  "asdf",
  "sdfg",
  "dfgh",
  "zxcv",
  "cvbn",
  "vbnm",
];

type PasswordStrengthLabel = "Empty" | "Weak" | "Fair" | "Good" | "Strong";

export interface PasswordStrength {
  score: number;
  percentage: number;
  label: PasswordStrengthLabel;
  meetsRequirements: boolean;
}

function hasSequentialRun(password: string): boolean {
  const normalized = password.toLowerCase();
  return SEQUENTIAL_RUNS.some((run) => normalized.includes(run));
}

export function getPasswordStrength(password: string): PasswordStrength {
  const policyScore = PASSWORD_REQUIREMENTS.reduce(
    (total, requirement) => total + (requirement.met(password) ? 1 : 0),
    0,
  );
  const meetsRequirements = policyScore === PASSWORD_REQUIREMENTS.length;
  const hasWeakPattern =
    COMMON_PASSWORDS.has(password.toLowerCase()) ||
    /(.)\1{2,}/.test(password) ||
    hasSequentialRun(password);
  let score = policyScore + (password.length >= 12 ? 1 : 0);
  if (hasWeakPattern) score = Math.max(0, score - 2);

  let label: PasswordStrengthLabel = "Empty";
  if (password.length > 0) {
    if (!meetsRequirements) label = score <= 2 ? "Weak" : "Fair";
    else if (hasWeakPattern) label = "Weak";
    else if (password.length >= 12 && score >= 6) label = "Strong";
    else if (score >= 4) label = "Good";
    else label = "Fair";
  }

  return {
    score,
    percentage: password.length > 0 ? (score / 6) * 100 : 0,
    label,
    meetsRequirements,
  };
}

const strengthBarClasses: Record<PasswordStrengthLabel, string> = {
  Empty: "bg-gray-200",
  Weak: "bg-red-500",
  Fair: "bg-amber-500",
  Good: "bg-blue-500",
  Strong: "bg-green-500",
};

const strengthTranslationKeys: Record<PasswordStrengthLabel, string> = {
  Empty: "strength.empty",
  Weak: "strength.weak",
  Fair: "strength.fair",
  Good: "strength.good",
  Strong: "strength.strong",
};

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {children}
    </p>
  );
}

export default function RegisterForm() {
  const t = useTranslations("auth.register");
  const tRoot = useTranslations();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const password = watch("password") ?? "";
  const strength = getPasswordStrength(password);
  const fullNameMessage = errors.fullName?.message;
  const emailMessage = errors.email?.message;
  const passwordMessage = errors.password?.message;
  const confirmPasswordMessage = errors.confirmPassword?.message;
  const fullNameError = fullNameMessage ? tRoot(fullNameMessage) : undefined;
  const emailError = emailMessage ? tRoot(emailMessage) : undefined;
  const passwordError = passwordMessage ? tRoot(passwordMessage) : undefined;
  const confirmPasswordError = confirmPasswordMessage
    ? tRoot(confirmPasswordMessage)
    : undefined;

  async function onSubmit(values: RegisterFormValues) {
    setSubmitError(null);

    try {
      const data = await apiRequest<LoginResponse>(
        "/api/v1/auth/register",
        {
          method: "POST",
          credentials: "include",
          anonymous: true,
          body: {
            fullName: values.fullName,
            email: values.email,
            password: values.password,
          },
        },
      );
      storeSession(data);
      router.replace("/");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setSubmitError(t("apiErrors.emailExists"));
      } else if (error instanceof ApiError && error.status === 422) {
        setSubmitError(t("apiErrors.validation"));
      } else {
        setSubmitError(t("apiErrors.generic"));
      }
    }
  }

  const passwordErrorId = passwordError ? "register-password-error" : undefined;
  const passwordDescription = [
    "register-password-strength",
    "register-password-summary",
    passwordError ? passwordErrorId : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const confirmPasswordErrorId = confirmPasswordError
    ? "register-confirm-password-error"
    : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <Card variant="elevated" className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold leading-none tracking-tight">
            {t("title")}
          </h1>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            {submitError ? (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {submitError}
              </p>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="fullName" className="text-sm font-medium">
                {t("fullNameLabel")}
              </label>
              <Input
                id="fullName"
                type="text"
                autoComplete="name"
                required
                placeholder={t("fullNamePlaceholder")}
                variant={fullNameError ? "error" : "default"}
                aria-invalid={Boolean(fullNameError)}
                aria-describedby={fullNameError ? "register-full-name-error" : undefined}
                {...register("fullName")}
              />
              {fullNameError ? (
                <FieldError id="register-full-name-error">{fullNameError}</FieldError>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                {t("emailLabel")}
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder={t("emailPlaceholder")}
                variant={emailError ? "error" : "default"}
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? "register-email-error" : undefined}
                {...register("email")}
              />
              {emailError ? (
                <FieldError id="register-email-error">{emailError}</FieldError>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                {t("passwordLabel")}
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder={t("passwordPlaceholder")}
                variant={passwordError ? "error" : "default"}
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordDescription || undefined}
                {...register("password")}
              />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("strengthLabel")}</span>
                  <span>{t(strengthTranslationKeys[strength.label])}</span>
                </div>
                <div
                  id="register-password-strength"
                  role="progressbar"
                  aria-label={t("strengthLabel")}
                  aria-valuemin={0}
                  aria-valuemax={6}
                  aria-valuenow={strength.score}
                  aria-valuetext={t(strengthTranslationKeys[strength.label])}
                  className="h-2 overflow-hidden rounded-full bg-gray-200"
                >
                  <div
                    className={`h-full rounded-full transition-all ${strengthBarClasses[strength.label]}`}
                    style={{ width: `${strength.percentage}%` }}
                  />
                </div>
                <p
                  id="register-password-summary"
                  className="text-xs text-muted-foreground"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {t("strengthSummary", {
                    label: t(strengthTranslationKeys[strength.label]),
                  })}
                </p>
                <p className="text-xs text-muted-foreground">{t("guidance")}</p>
                <ul
                  className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2"
                  aria-label={t("requirementsLabel")}
                >
                  {PASSWORD_REQUIREMENTS.map((requirement) => {
                    const met = requirement.met(password);
                    return (
                      <li
                        key={requirement.id}
                        className={met ? "text-green-700" : "text-muted-foreground"}
                      >
                        <span className="font-medium">
                          {met ? t("requirementMet") : t("requirementNeeded")}:
                        </span>{" "}
                        {t(`requirements.${requirement.id}`)}
                      </li>
                    );
                  })}
                </ul>
              </div>
              {passwordError ? (
                <FieldError id={passwordErrorId!}>{passwordError}</FieldError>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                {t("confirmPasswordLabel")}
              </label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                placeholder={t("confirmPasswordPlaceholder")}
                variant={confirmPasswordError ? "error" : "default"}
                aria-invalid={Boolean(confirmPasswordError)}
                aria-describedby={confirmPasswordErrorId}
                {...register("confirmPassword", { deps: ["password"] })}
              />
              {confirmPasswordError ? (
                <FieldError id={confirmPasswordErrorId!}>
                  {confirmPasswordError}
                </FieldError>
              ) : null}
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("alreadyHaveAccount")} {" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t("signIn")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
