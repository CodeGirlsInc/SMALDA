export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  title: string;
  description?: string;
  type?: ToastType;
  duration?: number;
}

export interface ToastItem extends ToastOptions {
  id: string;
  type: ToastType;
  duration: number;
}
