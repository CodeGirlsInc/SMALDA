"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/Button";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  status: "Active" | "Suspended";
  joinedAt: string;
}

const initialUsers: AdminUser[] = [
  {
    id: "1",
    name: "Amara Reyes",
    email: "amara@smalda.com",
    role: "user",
    status: "Active",
    joinedAt: "2026-01-20",
  },
  {
    id: "2",
    name: "Nia Banda",
    email: "nia@smalda.com",
    role: "admin",
    status: "Active",
    joinedAt: "2026-02-04",
  },
  {
    id: "3",
    name: "Chinwe Okafor",
    email: "chinwe@smalda.com",
    role: "user",
    status: "Suspended",
    joinedAt: "2026-03-11",
  },
];

export default function AdminPage() {
  const router = useRouter();
  const auth = useAuth();
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);

  useEffect(() => {
    if (!auth.isLoading && (!auth.user || auth.user.role !== "admin")) {
      router.push("/dashboard");
    }
  }, [auth.isLoading, auth.user, router]);

  const stats = useMemo(
    () => ({
      totalUsers: 1584,
      totalDocuments: 3820,
      verifiedCount: 1024,
    }),
    []
  );

  const toggleSuspend = (id: string) => {
    setUsers((current) =>
      current.map((user) =>
        user.id === id
          ? {
              ...user,
              status: user.status === "Active" ? "Suspended" : "Active",
            }
          : user
      )
    );
  };

  const toggleRole = (id: string) => {
    setUsers((current) =>
      current.map((user) =>
        user.id === id
          ? {
              ...user,
              role: user.role === "admin" ? "user" : "admin",
            }
          : user
      )
    );
  };

  if (auth.isLoading) {
    return <div className="min-h-screen p-6">Loading admin panel...</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-600">Admin Panel</p>
            <h1 className="text-3xl font-semibold text-slate-900">Platform statistics and user management</h1>
            <p className="mt-2 text-sm text-slate-600 max-w-2xl">
              Monitor platform health and manage account roles for the community.
            </p>
          </div>
          <Link href="/dashboard" className="text-sm text-indigo-600 underline">
            Back to dashboard
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Total users</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{stats.totalUsers}</p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Total documents</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{stats.totalDocuments}</p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Verified documents</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{stats.verifiedCount}</p>
          </article>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-slate-900">User directory</h2>
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-slate-600">Name</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Email</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Role</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Joined</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-4 text-slate-900">{user.name}</td>
                      <td className="px-4 py-4 text-slate-600">{user.email}</td>
                      <td className="px-4 py-4 text-slate-600 capitalize">{user.role}</td>
                      <td className="px-4 py-4 text-slate-600">{user.status}</td>
                      <td className="px-4 py-4 text-slate-600">{user.joinedAt}</td>
                      <td className="px-4 py-4 space-x-2">
                        <Button
                          variant={user.status === "Active" ? "danger" : "secondary"}
                          size="sm"
                          onClick={() => toggleSuspend(user.id)}
                        >
                          {user.status === "Active" ? "Suspend" : "Activate"}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => toggleRole(user.id)}>
                          Change role
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
