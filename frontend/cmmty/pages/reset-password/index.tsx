"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import ResetPasswordForm from "./ResetPasswordForm";

const ResetPasswordPage = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            Reset Password
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your new password below
          </p>
        </div>

        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">Invalid or missing reset token.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
