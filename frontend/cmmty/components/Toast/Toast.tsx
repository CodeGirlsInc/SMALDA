"use client";

import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { ComponentType } from "react";
import { useToast } from "./useToast";
import { ToastType } from "./types";

const toastTheme: Record<ToastType, { icon: ComponentType<{ className?: string }>; style: string }> = {
  success: {
    icon: CheckCircle2,
    style: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  error: {
    icon: AlertCircle,
    style: "border-red-200 bg-red-50 text-red-900",
  },
  warning: {
    icon: TriangleAlert,
    style: "border-amber-200 bg-amber-50 text-amber-900",
  },
  info: {
    icon: Info,
    style: "border-blue-200 bg-blue-50 text-blue-900",
  },
};

export default function ToastStack() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => {
        const theme = toastTheme[toast.type];
        const Icon = theme.icon;

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-md border p-3 shadow-sm ${theme.style}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.description ? (
                <p className="mt-1 text-xs opacity-80">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="rounded p-1 opacity-70 hover:bg-black/5 hover:opacity-100"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
