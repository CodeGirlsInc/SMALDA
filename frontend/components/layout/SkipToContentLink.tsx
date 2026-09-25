"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { MAIN_CONTENT_ID } from "@/lib/main-content";

function focusMainContent(event: MouseEvent<HTMLAnchorElement>) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  event.preventDefault();

  const fallback = document.getElementById(MAIN_CONTENT_ID);
  const main = document.querySelector<HTMLElement>("main") ?? fallback;

  if (!main) {
    return;
  }

  if (main.tagName === "MAIN") {
    fallback?.removeAttribute("id");
    main.id = MAIN_CONTENT_ID;
  }

  if (!main.hasAttribute("tabindex")) {
    main.tabIndex = -1;
  }

  main.setAttribute("data-skip-link-target", "true");
  main.focus();
}

export function SkipToContentLink() {
  return (
    <Link
      href={`#${MAIN_CONTENT_ID}`}
      onClick={focusMainContent}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
    >
      Skip to main content
    </Link>
  );
}
