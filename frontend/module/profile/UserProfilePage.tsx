"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CheckCircle, XCircle, ShieldCheck, ShieldOff } from "lucide-react";

interface UserProfile {
  fullName: string;
  email: string;
  role: string;
  isVerified: boolean;
  preferredLanguage: string;
  twoFactorEnabled: boolean;
  createdAt: string;
}

function SkeletonField() {
  return (
    <div className="animate-pulse space-y-1">
      <div className="h-3 w-20 rounded bg-gray-200" />
      <div className="h-5 w-40 rounded bg-gray-200" />
    </div>
  );
}

export default function UserProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/module/users/me`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );
      if (!res.ok) throw new Error();
      setProfile(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function handleResend() {
    setResending(true);
    setResendMsg(null);
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/resend-verification`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );
      setResendMsg("Verification email sent.");
    } catch {
      setResendMsg("Failed to send. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        {!loading && (
          <Link
            href="/profile/edit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Edit Profile
          </Link>
        )}
      </div>

      {!loading && profile && !profile.isVerified && (
        <div className="flex items-center justify-between rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
          <p className="text-sm text-yellow-800">
            Your email is not verified. Please check your inbox.
          </p>
          <button
            onClick={handleResend}
            disabled={resending}
            className="ml-4 text-sm font-semibold text-yellow-800 underline disabled:opacity-60"
          >
            {resending ? "Sendingâ€¦" : "Resend"}
          </button>
          {resendMsg && <span className="ml-2 text-xs text-yellow-700">{resendMsg}</span>}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonField key={i} />)
          ) : profile ? (
            <>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-400">Full Name</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{profile.fullName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-400">Email</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-900">
                  {profile.email}
                  {profile.isVerified ? (
                    <CheckCircle className="h-4 w-4 text-green-500" aria-label="Verified" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" aria-label="Unverified" />
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-400">Role</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{profile.role}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-400">Language</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{profile.preferredLanguage}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-400">Member Since</dt>
                <dd className="mt-0.5 text-sm text-gray-900">
                  {new Date(profile.createdAt).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-400">Two-Factor Auth</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-sm">
                  {profile.twoFactorEnabled ? (
                    <>
                      <ShieldCheck className="h-4 w-4 text-green-500" aria-hidden="true" />
                      <Link href="/settings/2fa" className="text-green-700 hover:underline">
                        Enabled
                      </Link>
                    </>
                  ) : (
                    <>
                      <ShieldOff className="h-4 w-4 text-gray-400" aria-hidden="true" />
                      <Link href="/settings/2fa" className="text-gray-500 hover:underline">
                        Disabled
                      </Link>
                    </>
                  )}
                </dd>
              </div>
            </>
          ) : (
            <p className="col-span-2 text-sm text-red-600">Failed to load profile.</p>
          )}
        </dl>
      </div>
    </div>
  );
}
