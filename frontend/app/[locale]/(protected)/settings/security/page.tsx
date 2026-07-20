"use client";

import React, { useState } from "react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Session {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
}

// ─────────────────────────────────────────────
// Mock data (replace with real API calls)
// ─────────────────────────────────────────────
const MOCK_SESSIONS: Session[] = [
  {
    id: "s1",
    device: "Chrome on Windows 11",
    location: "Lagos, Nigeria",
    lastActive: "Just now",
    current: true,
  },
  {
    id: "s2",
    device: "Safari on iPhone 15",
    location: "Abuja, Nigeria",
    lastActive: "2 hours ago",
    current: false,
  },
  {
    id: "s3",
    device: "Firefox on Ubuntu",
    location: "London, UK",
    lastActive: "Yesterday",
    current: false,
  },
];

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ChangePasswordForm() {
  const [form, setForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.next !== form.confirm) {
      setError("New passwords do not match.");
      return;
    }
    if (form.next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      // Replace with: await api.patch('/auth/change-password', form)
      await new Promise((r) => setTimeout(r, 800));
      setSuccess(true);
      setForm({ current: "", next: "", confirm: "" });
    } catch {
      setError("Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {(
        [
          { name: "current", label: "Current password" },
          { name: "next", label: "New password" },
          { name: "confirm", label: "Confirm new password" },
        ] as const
      ).map(({ name, label }) => (
        <div key={name} className="flex flex-col gap-1">
          <label
            htmlFor={name}
            className="text-sm font-medium text-gray-700"
          >
            {label}
          </label>
          <input
            id={name}
            name={name}
            type="password"
            autoComplete={
              name === "current" ? "current-password" : "new-password"
            }
            value={form[name]}
            onChange={handleChange}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
      ))}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          Password updated successfully.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="self-start rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

function TwoFactorToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      // Replace with: await api.patch('/auth/2fa', { enabled: !enabled })
      await new Promise((r) => setTimeout(r, 600));
      setEnabled((prev) => !prev);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900">
          Two-factor authentication
        </p>
        <p className="text-sm text-gray-500">
          {enabled
            ? "2FA is active. Your account has an extra layer of protection."
            : "Add an extra layer of security to your account."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={handleToggle}
        disabled={loading}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
          enabled ? "bg-blue-600" : "bg-gray-300"
        }`}
      >
        <span className="sr-only">
          {enabled ? "Disable 2FA" : "Enable 2FA"}
        </span>
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function ActiveSessionsList() {
  const [sessions, setSessions] = useState<Session[]>(MOCK_SESSIONS);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function handleRevoke(id: string) {
    setRevoking(id);
    try {
      // Replace with: await api.delete(`/auth/sessions/${id}`)
      await new Promise((r) => setTimeout(r, 500));
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setRevoking(null);
    }
  }

  return (
    <ul className="divide-y divide-gray-100" aria-label="Active sessions">
      {sessions.map((session) => (
        <li
          key={session.id}
          className="flex items-center justify-between py-3"
        >
          <div>
            <p className="text-sm font-medium text-gray-900">
              {session.device}
              {session.current && (
                <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  This device
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500">
              {session.location} · {session.lastActive}
            </p>
          </div>
          {!session.current && (
            <button
              type="button"
              onClick={() => handleRevoke(session.id)}
              disabled={revoking === session.id}
              className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {revoking === session.id ? "Revoking…" : "Revoke"}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function SecuritySettingsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        Security Settings
      </h1>

      <div className="flex flex-col gap-6">
        <SectionCard
          title="Change Password"
          description="Use a strong, unique password you don't use elsewhere."
        >
          <ChangePasswordForm />
        </SectionCard>

        <SectionCard
          title="Two-Factor Authentication"
          description="Protect your land documents with an additional verification step."
        >
          <TwoFactorToggle />
        </SectionCard>

        <SectionCard
          title="Active Sessions"
          description="These devices are currently signed in to your account. Revoke any session you don't recognise."
        >
          <ActiveSessionsList />
        </SectionCard>
      </div>
    </main>
  );
}