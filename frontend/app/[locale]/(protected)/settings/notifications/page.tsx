"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationKey =
  | "risk_alert"
  | "verification_complete"
  | "dispute_update"
  | "system_notifications";

interface NotificationPreference {
  key: NotificationKey;
  label: string;
  description: string;
  email: boolean;
  inApp: boolean;
}

interface PreferencesPayload {
  [key: string]: { email: boolean; inApp: boolean };
}

// ---------------------------------------------------------------------------
// Notification type definitions
// ---------------------------------------------------------------------------

const NOTIFICATION_TYPES: Pick<NotificationPreference, "key" | "label" | "description">[] = [
  {
    key: "risk_alert",
    label: "Risk Alert",
    description:
      "Notifies you when a document you uploaded receives a high or medium risk score from our analysis engine.",
  },
  {
    key: "verification_complete",
    label: "Verification Complete",
    description:
      "Sent when a document verification or blockchain anchoring has finished processing.",
  },
  {
    key: "dispute_update",
    label: "Dispute Update",
    description:
      "Updates on disputes you have raised or that involve your documents.",
  },
  {
    key: "system_notifications",
    label: "System Notifications",
    description:
      "Platform announcements, scheduled maintenance, and policy updates.",
  },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ---------------------------------------------------------------------------
// Custom debounce hook
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// ---------------------------------------------------------------------------
// Toggle component
// ---------------------------------------------------------------------------

interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  isSaving: boolean;
  hasError: boolean;
  label: string;
}

function Toggle({ id, checked, onChange, isSaving, hasError, label }: ToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        id={id}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
          checked ? "bg-blue-600" : "bg-gray-300"
        } ${hasError ? "ring-2 ring-red-400" : ""}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      {isSaving && (
        <span
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
          aria-label="Saving…"
        />
      )}
      {hasError && !isSaving && (
        <span className="text-xs text-red-500" role="alert">
          Save failed
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NotificationsSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreference[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Track which keys are currently saving or have an error
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [errorKeys, setErrorKeys] = useState<Set<string>>(new Set());

  // Previous snapshot per key for rollback on error
  const previousRef = useRef<Map<string, { email: boolean; inApp: boolean }>>(
    new Map()
  );

  // Pending changes queue (key -> channel -> value), flushed after 500ms debounce
  const [pendingChanges, setPendingChanges] = useState<
    Map<string, { email?: boolean; inApp?: boolean }>
  >(new Map());

  const debouncedPending = useDebounce(pendingChanges, 500);

  // ── Load preferences on mount ───────────────────────────────────────────

  useEffect(() => {
    async function fetchPrefs() {
      try {
        const res = await fetch(`${API_BASE}/api/users/me/notification-preferences`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error(`Failed to load preferences: ${res.status}`);
        const json = await res.json();

        // Map API response to local state — default unset keys to true
        const mapped: NotificationPreference[] = NOTIFICATION_TYPES.map((t) => ({
          ...t,
          email: json?.data?.[t.key]?.email ?? true,
          inApp: json?.data?.[t.key]?.inApp ?? true,
        }));
        setPrefs(mapped);
      } catch (err: unknown) {
        setLoadError(
          err instanceof Error ? err.message : "Failed to load preferences"
        );
      }
    }
    fetchPrefs();
  }, []);

  // ── Flush debounced changes ─────────────────────────────────────────────

  const saveChanges = useCallback(
    async (changes: Map<string, { email?: boolean; inApp?: boolean }>) => {
      if (changes.size === 0) return;

      const keysToSave = Array.from(changes.keys());

      // Mark as saving
      setSavingKeys((prev) => {
        const next = new Set(prev);
        keysToSave.forEach((k) => next.add(k));
        return next;
      });
      setErrorKeys((prev) => {
        const next = new Set(prev);
        keysToSave.forEach((k) => next.delete(k));
        return next;
      });

      // Build payload from current prefs + pending changes
      const payload: PreferencesPayload = {};
      setPrefs((currentPrefs) => {
        if (!currentPrefs) return currentPrefs;
        currentPrefs.forEach((p) => {
          const change = changes.get(p.key);
          payload[p.key] = {
            email: change?.email !== undefined ? change.email : p.email,
            inApp: change?.inApp !== undefined ? change.inApp : p.inApp,
          };
        });
        return currentPrefs;
      });

      try {
        const res = await fetch(`${API_BASE}/api/users/me/notification-preferences`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`Save failed: ${res.status}`);

        // Clear pending for saved keys
        setPendingChanges((prev) => {
          const next = new Map(prev);
          keysToSave.forEach((k) => next.delete(k));
          return next;
        });
      } catch {
        // Rollback affected keys
        setPrefs((currentPrefs) => {
          if (!currentPrefs) return currentPrefs;
          return currentPrefs.map((p) => {
            const snapshot = previousRef.current.get(p.key);
            if (keysToSave.includes(p.key) && snapshot) {
              return { ...p, ...snapshot };
            }
            return p;
          });
        });

        setErrorKeys((prev) => {
          const next = new Set(prev);
          keysToSave.forEach((k) => next.add(k));
          return next;
        });
      } finally {
        setSavingKeys((prev) => {
          const next = new Set(prev);
          keysToSave.forEach((k) => next.delete(k));
          return next;
        });
      }
    },
    []
  );

  useEffect(() => {
    if (debouncedPending.size > 0) {
      saveChanges(debouncedPending);
    }
  }, [debouncedPending, saveChanges]);

  // ── Handle toggle ───────────────────────────────────────────────────────

  function handleToggle(
    key: NotificationKey,
    channel: "email" | "inApp",
    newValue: boolean
  ) {
    // Store previous state for potential rollback
    setPrefs((currentPrefs) => {
      if (!currentPrefs) return currentPrefs;
      const current = currentPrefs.find((p) => p.key === key);
      if (current) {
        previousRef.current.set(key, { email: current.email, inApp: current.inApp });
      }
      return currentPrefs.map((p) =>
        p.key === key ? { ...p, [channel]: newValue } : p
      );
    });

    // Queue for debounced save
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const existing = next.get(key) ?? {};
      next.set(key, { ...existing, [channel]: newValue });
      return next;
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <p className="text-red-600 text-sm" role="alert">
          {loadError}
        </p>
      </main>
    );
  }

  if (!prefs) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <p className="text-sm text-gray-500" role="status">
          Loading preferences…
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Notification Preferences
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Toggle changes are saved automatically. There is no Save button needed.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-left font-medium text-gray-600 w-1/2"
              >
                Notification type
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-center font-medium text-gray-600"
              >
                Email
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-center font-medium text-gray-600"
              >
                In-App
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {prefs.map((pref) => (
              <tr key={pref.key}>
                <td className="px-4 py-4">
                  <p className="font-medium text-gray-900">{pref.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {pref.description}
                  </p>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="flex justify-center">
                    <Toggle
                      id={`${pref.key}-email`}
                      checked={pref.email}
                      onChange={(v) => handleToggle(pref.key, "email", v)}
                      isSaving={savingKeys.has(pref.key)}
                      hasError={errorKeys.has(pref.key)}
                      label={`${pref.label} email notifications`}
                    />
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="flex justify-center">
                    <Toggle
                      id={`${pref.key}-inapp`}
                      checked={pref.inApp}
                      onChange={(v) => handleToggle(pref.key, "inApp", v)}
                      isSaving={savingKeys.has(pref.key)}
                      hasError={errorKeys.has(pref.key)}
                      label={`${pref.label} in-app notifications`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}