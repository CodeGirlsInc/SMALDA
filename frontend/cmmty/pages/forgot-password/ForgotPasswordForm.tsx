"use client";

import React, { useState } from "react";
import { useZodForm, forgotPasswordSchema } from "../../lib/forms";
import { Input } from "../../components/Input";

const ForgotPasswordForm = () => {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useZodForm(forgotPasswordSchema, {
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: { email: string }) => {
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });
    } catch {
      // swallow errors to avoid enumeration
    } finally {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-md bg-green-50 p-4">
        <p className="text-sm text-green-800">
          If an account exists with that email, a reset link has been sent.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <Input
        id="email"
        label="Email address"
        type="email"
        autoComplete="email"
        placeholder="Enter your email"
        error={!!errors.email}
        errorMessage={errors.email?.message}
        {...register("email")}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center min-h-[44px] rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
      >
        {isSubmitting ? "Sending..." : "Send Reset Link"}
      </button>
    </form>
  );
};

export default ForgotPasswordForm;
