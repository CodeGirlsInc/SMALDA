"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useZodForm, passwordResetSchema } from "../../lib/forms";
import { Input } from "../../components/Input";

interface Props {
  token: string;
}

const ResetPasswordForm: React.FC<Props> = ({ token }) => {
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useZodForm(passwordResetSchema, {
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (data: { newPassword: string; confirmPassword: string }) => {
    setApiError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: data.newPassword }),
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        setApiError("Invalid or expired token. Please request a new reset link.");
      }
    } catch {
      setApiError("Something went wrong. Please try again.");
    }
  };

  if (success) {
    return (
      <div className="rounded-md bg-green-50 p-4 text-center">
        <p className="text-sm text-green-800">
          Password reset successful!
        </p>
        <Link
          href="/login"
          className="mt-3 inline-flex min-h-[44px] items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {apiError && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{apiError}</p>
        </div>
      )}

      <Input
        id="newPassword"
        label="New password"
        type="password"
        autoComplete="new-password"
        error={!!errors.newPassword}
        errorMessage={errors.newPassword?.message}
        helperText="Must be at least 8 characters with uppercase, lowercase, and a number"
        {...register("newPassword")}
      />

      <Input
        id="confirmPassword"
        label="Confirm new password"
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
        {isSubmitting ? "Resetting..." : "Reset Password"}
      </button>
    </form>
  );
};

export default ResetPasswordForm;
