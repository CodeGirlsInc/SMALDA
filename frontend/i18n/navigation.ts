import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation APIs. Use these drop-in replacements for the
 * equivalents in `next/navigation` / `next/link` so that the active locale is
 * carried across client-side navigations automatically.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
