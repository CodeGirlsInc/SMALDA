"use client";

import * as React from "react";

export type ToastVariant = "default" | "success" | "destructive" | "warning";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss. `0` keeps the toast until dismissed. */
  duration?: number;
}

export interface ToastRecord extends ToastOptions {
  id: string;
}

export const TOAST_DEFAULT_DURATION = 5000;
export const TOAST_MAX_VISIBLE = 3;

type ToastAction = { type: "ADD"; toast: ToastRecord } | { type: "DISMISS"; id: string };

function toastReducer(state: ToastRecord[], action: ToastAction): ToastRecord[] {
  switch (action.type) {
    case "ADD":
      // Newest wins: keep only the most recent TOAST_MAX_VISIBLE entries.
      return [...state, action.toast].slice(-TOAST_MAX_VISIBLE);
    case "DISMISS":
      return state.filter((toast) => toast.id !== action.id);
  }
}

interface ToastContextValue {
  toasts: ToastRecord[];
  /** Queue a toast. Returns its id so the caller can dismiss it early. */
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = React.useReducer(toastReducer, []);
  const nextId = React.useRef(0);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    dispatch({ type: "DISMISS", id });
  }, []);

  const toast = React.useCallback(
    (options: ToastOptions) => {
      const id = `toast-${nextId.current++}`;
      dispatch({ type: "ADD", toast: { ...options, id } });

      const duration = options.duration ?? TOAST_DEFAULT_DURATION;
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration)
        );
      }
      return id;
    },
    [dismiss]
  );

  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = React.useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (context === null) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
