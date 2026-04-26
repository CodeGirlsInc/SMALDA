"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { InputProps } from "./types";

export default function Input({
  id,
  type = "text",
  label,
  helperText,
  error,
  errorMessage,
  leftIcon,
  rightIcon,
  className,
  disabled,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const [showPassword, setShowPassword] = useState(false);

  const resolvedType =
    type === "password" && showPassword ? "text" : type;

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-gray-800">
          {label}
        </label>
      ) : null}
      <div className="relative">
        {leftIcon ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-500">
            {leftIcon}
          </span>
        ) : null}
        <input
          id={inputId}
          type={resolvedType}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100 ${leftIcon ? "pl-10" : ""} ${(rightIcon || type === "password") ? "pr-10" : ""} ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-200"
              : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
          } ${className ?? ""}`}
          {...props}
        />

        {type === "password" ? (
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-2 flex items-center px-1 text-gray-600 hover:text-gray-800"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : rightIcon ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
            {rightIcon}
          </span>
        ) : null}
      </div>
      {error && errorMessage ? (
        <p id={errorId} className="mt-1 text-xs text-red-600">
          {errorMessage}
        </p>
      ) : helperText ? (
        <p id={helperId} className="mt-1 text-xs text-gray-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
