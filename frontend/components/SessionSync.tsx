"use client";

import { useEffect } from "react";
import { initCrossTabLogoutSync } from "@/lib/session-expiry-warning";

export function SessionSync() {
  useEffect(() => initCrossTabLogoutSync(), []);
  return null;
}
