"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  routing,
  type Locale,
} from "@/i18n/routing";
import { ApiError, request } from "@/lib/api-client";
import { apiUrl } from "@/lib/api-config";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface UserProfile {
  fullName: string;
  email: string;
  preferredLanguage: string;
}

type ProfileChanges = Pick<UserProfile, "fullName" | "preferredLanguage">;
type ProfileForm = UserProfile;

const SUPPORTED_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
async function fetchCurrentUser(): Promise<UserProfile> {
  return request<UserProfile>(apiUrl("/users/me"));
}

async function patchUser(changes: Partial<ProfileChanges>): Promise<UserProfile> {
  return request<UserProfile>(apiUrl("/users/me"), {
    method: "PATCH",
    credentials: "include",
    body: changes,
  });
}

function getChangedFields(
  original: ProfileForm,
  current: ProfileForm
): Partial<ProfileChanges> {
  const changes: Partial<ProfileChanges> = {};
  if (current.fullName !== original.fullName) {
    changes.fullName = current.fullName;
  }
  if (current.preferredLanguage !== original.preferredLanguage) {
    changes.preferredLanguage = current.preferredLanguage;
  }
  return changes;
}

function persistLocalePreference(locale: Locale): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.backendMessage ?? fallback;
  return fallback;
}

// ─────────────────────────────────────────────
// Toast (minimal inline)
// ─────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 rounded-xl bg-green-600 px-5 py-3 text-sm font-medium text-white shadow-lg"
    >
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function ProfilePage() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [original, setOriginal] = useState<ProfileForm | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentUser()
      .then((user) => {
        setOriginal(user);
        setForm(user);
      })
      .catch((err: unknown) =>
        setError(describeError(err, "Failed to load profile. Please refresh."))
      )
      .finally(() => setLoading(false));
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => (prev ? { ...prev, [name]: value } : prev));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !original) return;

    const fullName = form.fullName.trim();
    if (fullName.length < 2) {
      setError(t("auth.register.errors.fullNameMin"));
      return;
    }
    if (fullName.length > 120) {
      setError("Full name must be 120 characters or fewer.");
      return;
    }
    if (!routing.locales.includes(form.preferredLanguage as Locale)) {
      setError(t("errors.status.validation"));
      return;
    }

    const changes = getChangedFields(original, { ...form, fullName });
    if (Object.keys(changes).length === 0) {
      setToast("No changes to save.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await patchUser(changes);
      setOriginal(updated);
      setForm(updated);
      setToast("Profile updated successfully.");
      if (
        changes.preferredLanguage &&
        changes.preferredLanguage !== original.preferredLanguage
      ) {
        const locale = changes.preferredLanguage as Locale;
        persistLocalePreference(locale);
        router.replace(pathname, { locale });
      }
    } catch (err) {
      setError(describeError(err, t("errors.status.unknown")));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading profile">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      </main>
    );
  }

  if (!form) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm text-red-600">{error ?? t("errors.status.unknown")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">My Profile</h1>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

        {/* Full name */}
        <div className="flex flex-col gap-1">
          <label htmlFor="fullName" className="text-sm font-medium text-gray-700">
            Full name <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            value={form.fullName}
            onChange={handleChange}
            required
            autoComplete="name"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            readOnly
            autoComplete="email"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Preferred language */}
        <div className="flex flex-col gap-1">
          <label htmlFor="preferredLanguage" className="text-sm font-medium text-gray-700">
            Preferred language
          </label>
          <select
            id="preferredLanguage"
            name="preferredLanguage"
            value={form.preferredLanguage}
            onChange={handleChange}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            Language preference applies to emails and API messages.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="self-start rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </main>
  );
}
