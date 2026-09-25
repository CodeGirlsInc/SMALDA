"use client";

import { useCallback, useEffect } from "react";
import { refreshSession } from "@/lib/api-client";
import {
  initCrossTabLogoutSync,
  useSessionExpiryWarning,
} from "@/lib/session-expiry-warning";

export function SessionExpiryGuard() {
  const onRefresh = useCallback(() => refreshSession(), []);

  useSessionExpiryWarning({ onRefresh });
  useEffect(() => initCrossTabLogoutSync(), []);

  return null;
}
