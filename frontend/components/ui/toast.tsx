"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useToast, type ToastRecord } from "./use-toast";

const toastVariants = cva(
  "pointer-events-auto flex w-full items-start gap-3 rounded-lg border p-4 shadow-lg",
  {
    variants: {
      variant: {
        default: "border-border bg-background text-foreground",
        success:
          "border-green-300 bg-green-100 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100",
        destructive: "border-transparent bg-destructive text-white",
        warning:
          "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export type ToastProps = Omit<React.HTMLAttributes<HTMLDivElement>, "title"> &
  VariantProps<typeof toastVariants> & {
    title: string;
    description?: string;
    onDismiss?: () => void;
  };

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant, title, description, onDismiss, ...props }, ref) => {
    const isError = variant === "destructive";
    return (
      <div
        ref={ref}
        data-testid="toast"
        // Errors interrupt; everything else waits for a pause in speech.
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        className={cn(toastVariants({ variant }), className)}
        {...props}
      >
        <div className="flex-1">
          <p className="text-sm font-semibold">{title}</p>
          {description ? <p className="mt-1 text-sm opacity-90">{description}</p> : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="shrink-0 rounded-md px-1 text-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            &times;
          </button>
        ) : null}
      </div>
    );
  }
);
Toast.displayName = "Toast";

/**
 * Renders the toast viewport. Mount once, inside a ToastProvider.
 *
 * The outer region is permanently present so assistive technology observes
 * additions to it; individual toasts also carry a role for their severity.
 */
function Toaster({ className }: { className?: string }) {
  const { toasts, dismiss } = useToast();
  return (
    <div
      role="status"
      aria-live="polite"
      aria-relevant="additions text"
      className={cn(
        "pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2",
        className
      )}
    >
      {toasts.map((toast: ToastRecord) => (
        <Toast
          key={toast.id}
          title={toast.title}
          description={toast.description}
          variant={toast.variant}
          onDismiss={() => dismiss(toast.id)}
        />
      ))}
    </div>
  );
}
Toaster.displayName = "Toaster";

export { Toast, Toaster, toastVariants };
