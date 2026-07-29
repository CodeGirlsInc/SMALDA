import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compose Tailwind class names.
 *
 * `clsx` flattens conditionals and arrays; `twMerge` then resolves conflicts
 * using Tailwind's own precedence rules, so the last class wins regardless of
 * stylesheet order. This is what lets a caller's `className` override a
 * component's cva variant classes.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
