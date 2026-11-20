"use client";

import React, { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { clearSession, request } from "@/lib/api-client";
import { apiUrl } from "@/lib/api-config";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface AuthSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

interface Session extends AuthSession {
  current: boolean;
}

function getCurrentSessionId(): string | null {
  if (typeof window === "undefined") return null;
  let token: string | null;
  try {
    token = window.localStorage.getItem("refresh-token");
  } catch {
    return null;
  }
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { sid?: unknown };
    return typeof payload.sid === "string" ? payload.sid : null;
  } catch {
    return null;
  }
}

function toSessions(data: AuthSession[]): Session[] {
  const currentId = getCurrentSessionId();
  return data.map((session) => ({
    ...session,
    current: session.id === currentId,
  }));
}

function formatSessionTime(value: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

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
  const [loading, setLoading] = useState(true);
  const [disabling, setDisabling] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadStatus() {
      try {
        const me = await request<{ twoFactorEnabled?: boolean }>(
          apiUrl("/auth/me"),
        );
        if (active) setEnabled(Boolean(me.twoFactorEnabled));
      } catch {
        if (active) setError("Could not load two-factor status. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadStatus();
    return () => {
      active = false;
    };
  }, []);

  function handleToggle() {
    setError(null);
    setShowPassword((prev) => !prev);
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setDisabling(true);
    setError(null);
    try {
      await request(apiUrl("/auth/2fa/disable"), {
        method: "POST",
        body: { password },
      });
      setEnabled(false);
      setShowPassword(false);
      setPassword("");
    } catch {
      setError(
        "Could not disable two-factor authentication. Check your password and try again.",
      );
    } finally {
      setDisabling(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
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
        {loading ? (
          <span role="status" className="text-sm text-gray-500">
            Loading…
          </span>
        ) : enabled ? (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Disable 2FA"
            onClick={handleToggle}
            disabled={disabling}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
              enabled ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span className="sr-only">Disable 2FA</span>
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        ) : (
          <Link
            href="/2fa/setup"
            role="switch"
            aria-checked={false}
            aria-label="Enable 2FA"
            className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <span className="sr-only">Enable 2FA</span>
            <span className="inline-block h-4 w-4 translate-x-1 transform rounded-full bg-white shadow transition-transform" />
          </Link>
        )}
      </div>

      {showPassword && (
        <form
          onSubmit={handleDisable}
          className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
        >
          <label
            htmlFor="disable-2fa-password"
            className="text-sm font-medium text-gray-700"
          >
            Current password
          </label>
          <input
            id="disable-2fa-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={disabling || !password}
              className="self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {disabling ? "Disabling…" : "Disable 2FA"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPassword(false);
                setPassword("");
              }}
              disabled={disabling}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function ActiveSessionsList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadSessions() {
      try {
        const data = await request<AuthSession[]>(apiUrl("/auth/sessions"));
        if (active) setSessions(toSessions(data));
      } catch {
        if (active) setError("Could not load active sessions.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadSessions();
    return () => {
      active = false;
    };
  }, []);

  async function handleRevoke(id: string) {
    setRevoking(id);
    setError(null);
    try {
      await request(apiUrl(`/auth/sessions/${encodeURIComponent(id)}`), {
        method: "DELETE",
      });
      const data = await request<AuthSession[]>(apiUrl("/auth/sessions"));
      setSessions(toSessions(data));
    } catch {
      setError("Could not revoke this session. Please try again.");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div>
      {loading && (
        <p role="status" className="text-sm text-gray-500">
          Loading sessions…
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {!loading && sessions.length === 0 && (
        <p className="text-sm text-gray-500">No active sessions.</p>
      )}
      <ul className="divide-y divide-gray-100" aria-label="Active sessions">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="flex items-center justify-between py-3"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">
                {session.userAgent || "Unknown device"}
                {session.current && (
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    This device
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500">
                {session.ipAddress || "Unknown location"}
                <br />
                Signed in {formatSessionTime(session.createdAt)} · Last active{" "}
                {formatSessionTime(session.lastUsedAt)}
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
    </div>
  );
}

function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setDeleting(true);
    setError(null);
    try {
      await request(apiUrl("/users/me"), {
        method: "DELETE",
        body: { password },
      });
      const cleared = await clearSession();
      if (!cleared.ok) {
        throw new Error("Unable to clear the session safely.");
      }
      window.location.href = "/login";
    } catch {
      setError("Failed to delete account. Check your password and try again.");
      setDeleting(false);
    }
  }

  return (
    <div>
      {confirming ? (
        <form
          onSubmit={handleDelete}
          className="rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <p className="text-sm font-medium text-red-800">
            Are you sure? This action cannot be undone.
          </p>
          <p className="mt-1 text-xs text-red-700">
            Your account, documents and dispute records will be permanently
            deleted.
          </p>
          <label
            htmlFor="delete-account-password"
            className="mt-3 block text-sm font-medium text-red-800"
          >
            Current password
          </label>
          <input
            id="delete-account-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 rounded-lg border border-red-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            required
          />
          <div className="mt-3 flex gap-3">
            <button
              type="submit"
              disabled={deleting || !password}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Yes, delete my account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setPassword("");
                setError(null);
              }}
              disabled={deleting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Delete account…
        </button>
      )}
    </div>
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

        <SectionCard
          title="Danger Zone"
          description="Permanently delete your account and all associated data."
        >
          <DangerZone />
        </SectionCard>
      </div>
    </main>
  );
}