"use client";

import { useEffect } from "react";
import { clearLegacyTokens } from "@/lib/session";
import { initCrossTabLogoutSync } from "@/lib/session-expiry-warning";

export function SessionSync() {
  useEffect(() => {
    clearLegacyTokens();
    return initCrossTabLogoutSync();
  }, []);
  return null;
}
