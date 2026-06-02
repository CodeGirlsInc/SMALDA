"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "ar", label: "Arabic" },
  { code: "zh", label: "Chinese" },
];

interface ProfileData {
  fullName: string;
  preferredLanguage: string;
}

export default function EditProfileForm() {
  const router = useRouter();
  const [initial, setInitial] = useState<ProfileData | null>(null);
  const [fullName, setFullName] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const token = () => localStorage.getItem("access_token") ?? "";
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  useEffect(() => {
    fetch(`${apiBase}/api/module/users/me`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then((r) => r.json())
      .then((u) => {
        const data: ProfileData = {
          fullName: u.fullName ?? "",
          preferredLanguage: u.preferredLanguage ?? "en",
        };
        setInitial(data);
        setFullName(data.fullName);
        setPreferredLanguage(data.preferredLanguage);
      })
      .finally(() => setLoading(false));
  }, [apiBase]);

  const hasChanges =
    initial !== null &&
    (fullName !== initial.fullName || preferredLanguage !== initial.preferredLanguage);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasChanges) return;
    setSaving(true);
    setFieldErrors({});

    const body: Partial<ProfileData> = {};
    if (fullName !== initial!.fullName) body.fullName = fullName;
    if (preferredLanguage !== initial!.preferredLanguage)
      body.preferredLanguage = preferredLanguage;

    try {
      const res = await fetch(`${apiBase}/api/module/users/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.errors) {
          setFieldErrors(data.errors);
        } else {
          setToast(data.message ?? "Update failed.");
          setTimeout(() => setToast(null), 4000);
        }
        return;
      }

      setInitial({ fullName, preferredLanguage });
      setToast("Profile updated successfully.");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse space-y-1">
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="h-10 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>

      {toast && (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${
            toast.includes("success")
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {toast}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {fieldErrors.fullName && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.fullName}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Preferred Language
          </label>
          <select
            value={preferredLanguage}
            onChange={(e) => setPreferredLanguage(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          {fieldErrors.preferredLanguage && (
            <p className="mt-1 text-xs text-red-600">
              {fieldErrors.preferredLanguage}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!hasChanges || saving}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
