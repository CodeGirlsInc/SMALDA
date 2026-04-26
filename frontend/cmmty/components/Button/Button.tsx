"use client";

import { cx } from "clsx";
import { Loader2 } from "lucide-react";
import { ButtonProps } from "./types";

const variantClasses = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500",
  secondary:
    "bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 focus:ring-gray-300",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  ghost:
    "bg-transparent text-gray-900 hover:bg-gray-100 focus:ring-gray-200",
};

const sizeClasses = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={props.type ?? "button"}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 data-testid="spinner" className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
}
