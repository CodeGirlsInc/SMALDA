"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full rounded-md border bg-background text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:font-medium",
  {
    variants: {
      variant: {
        default: "border-input focus-visible:ring-ring",
        error: "border-destructive focus-visible:ring-destructive",
      },
      inputSize: {
        sm: "h-8 px-2 py-1 text-xs",
        md: "h-10 px-3 py-2 text-sm",
        lg: "h-11 px-4 py-2 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "md",
    },
  }
);

// The native `size` attribute is a number and would collide with a string
// variant prop, so the size variant is exposed as `inputSize`.
export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> &
  VariantProps<typeof inputVariants>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, variant, inputSize, type = "text", "aria-invalid": ariaInvalid, ...props },
    ref
  ) => (
    <input
      ref={ref}
      type={type}
      // Keep the visual error state and the assistive-technology state in sync,
      // unless the caller says otherwise.
      aria-invalid={ariaInvalid ?? (variant === "error" || undefined)}
      className={cn(inputVariants({ variant, inputSize }), className)}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input, inputVariants };
