"use client";

import { sanitizeUrl } from "@/lib/sanitize";
import { type ReactNode } from "react";

interface SafeLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  target?: "_blank" | "_self";
}

export function SafeLink({ href, children, className, target = "_self" }: SafeLinkProps) {
  const safeHref = sanitizeUrl(href);

  if (!safeHref) {
    return <span className={className}>{children}</span>;
  }

  return (
    <a
      href={safeHref}
      className={className}
      target={target}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  );
}
