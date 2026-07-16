"use client";

import React, { useEffect, useState } from "react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface UserProfile {
  fullName: string;
  email: string;
  preferredLanguage: string;
  profilePictureUrl: string;
}

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
  // Replace with real fetch: const res = await fetch('/api/users/me')
  return {
    fullName: "Jane Doe",
    email: "jane@example.com",
    preferredLanguage: "en",
    profilePictureUrl: "",
  };
}

async function patchUser(changes: Partial<ProfileForm>): Promise<void> {
  // Replace with real fetch:
  // await fetch('/api/users/me', { method: 'PATCH', body: JSON.stringify(changes) })
  await new Promise((r) => setTimeout(r, 700));
  console.log("PATCH /api/users/me", changes);
}

function getChangedFields(
  original: ProfileForm,
  current: ProfileForm
): Partial<ProfileForm> {
  const changes: Partial<ProfileForm> = {};
  for (const key of Object.keys(original) as (keyof ProfileForm)[]) {
    if (current[key] !== original[key]) {
      (changes as Record<string, string>)[key] = current[key];
    }
  }
  return changes;
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
  const [original, setOriginal] = useState<ProfileForm | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [emailWarning, setEmailWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentUser()
      .then((user) => {
        setOriginal(user);
        setForm(user);
      })
      .catch(() => setError("Failed to load profile. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => (prev ? { ...prev, [name]: value } : prev));
    setError(null);

    if (name === "email" && original && value !== original.email) {
      setEmailWarning(true);
    } else if (name === "email") {
      setEmailWarning(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !original) return;

    const changes = getChangedFields(original, form);
    if (Object.keys(changes).length === 0) {
      setToast("No changes to save.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await patchUser(changes);
      setOriginal(form);
      setEmailWarning(false);
      setToast("Profile updated successfully.");
    } catch {
      setError("Failed to save changes. Please try again.");
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
        <p className="text-sm text-red-600">{error ?? "Unable to load profile."}</p>
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
            Email <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
            autoComplete="email"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {emailWarning && (
            <p role="alert" className="rounded-lg bg-yellow-50 p-2 text-xs text-yellow-800">
              You will receive a verification email to confirm your new address.
            </p>
          )}
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

        {/* Profile picture URL */}
        <div className="flex flex-col gap-1">
          <label htmlFor="profilePictureUrl" className="text-sm font-medium text-gray-700">
            Profile picture URL
          </label>
          <input
            id="profilePictureUrl"
            name="profilePictureUrl"
            type="url"
            value={form.profilePictureUrl}
            onChange={handleChange}
            autoComplete="photo"
            placeholder="https://example.com/avatar.jpg"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {form.profilePictureUrl && (
            <img
              src={form.profilePictureUrl}
              alt="Profile picture preview"
              className="mt-2 h-16 w-16 rounded-full object-cover ring-2 ring-gray-200"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
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