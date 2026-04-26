"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useZodForm, registerSchema } from "../../lib/forms";
import { Input } from "../../components/Input";

export default function RegisterPage() {
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useZodForm(registerSchema, {
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => {
    setApiError(null);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSuccess(true);
    } catch {
      setApiError("Something went wrong. Please try again.");
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Account created!</h2>
          <p className="mt-2 text-sm text-gray-600">
            Your account has been created successfully. Please sign in.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex min-h-[44px] items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            Create your account
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join SMALDA for secure land document management
          </p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          {apiError && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{apiError}</p>
            </div>
          )}

          <Input
            id="fullName"
            label="Full name"
            autoComplete="name"
            error={!!errors.fullName}
            errorMessage={errors.fullName?.message}
            {...register("fullName")}
          />

          <Input
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            error={!!errors.email}
            errorMessage={errors.email?.message}
            {...register("email")}
          />

          <Input
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            error={!!errors.password}
            errorMessage={errors.password?.message}
            helperText="Must be at least 8 characters with uppercase, lowercase, and a number"
            {...register("password")}
          />

          <Input
            id="confirmPassword"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            error={!!errors.confirmPassword}
            errorMessage={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center min-h-[44px] rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
