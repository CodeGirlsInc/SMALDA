import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function toISODateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);

  return {
    from: toISODateOnly(from),
    to: toISODateOnly(to),
  };
}

