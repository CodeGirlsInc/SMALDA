"use client";

import { useCallback, useEffect, useState } from "react";
import ConfirmationModal from "../../components/confirmation-modal/ConfirmationModal";

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  verified: boolean;
  createdAt: string;
}

const ROLES = ["user", "admin", "reviewer"];
const PAGE_SIZE = 10;

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${verified ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
      {verified ? "Verified" : "Unverified"}
    </span>
  );
}

export default function AdminUsersTable() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filtered, setFiltered] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);
  const [roleMsg, setRoleMsg] = useState<{ id: string; msg: string } | null>(null);

  const token = () => localStorage.getItem("access_token") ?? "";
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  useEffect(() => {
    fetch(`${apiBase}/api/module/users/me`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then((r) => r.json())
      .then((u) => setIsAdmin(u.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, [apiBase]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      const res = await fetch(`${apiBase}/api/module/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.status === 403) throw new Error("403");
      if (!res.ok) throw new Error("Failed to load users.");
      const data = await res.json();
      const list = data.data ?? data;
      setUsers(list);
      setFiltered(list);
      setTotal(data.total ?? list.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }, [page, apiBase]);

  useEffect(() => {
    if (isAdmin === null) return;
    if (!isAdmin) { setError("403"); setLoading(false); return; }
    fetchUsers();
  }, [isAdmin, fetchUsers]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q ? users.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : users
    );
  }, [search, users]);

  async function handleRoleChange(userId: string, newRole: string) {
    setRoleLoading(userId);
    setRoleMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/module/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error("Failed to update role.");
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
      setRoleMsg({ id: userId, msg: "Role updated" });
    } catch {
      setRoleMsg({ id: userId, msg: "Failed to update" });
    } finally {
      setRoleLoading(null);
      setTimeout(() => setRoleMsg(null), 3000);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`${apiBase}/api/module/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {} finally {
      setDeleting(false);
    }
  }

  if (isAdmin === false || error === "403") {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-600">403 — You are not authorized to view this page.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4 p-6">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {error && error !== "403" && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Full Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Verified</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-gray-200" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{user.fullName}</td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      disabled={roleLoading === user.id}
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {roleMsg?.id === user.id && (
                      <span className="text-xs text-gray-500">{roleMsg.msg}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3"><VerifiedBadge verified={user.verified} /></td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setDeleteTarget(user)}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteTarget}
        title="Delete User"
        message={`Are you sure you want to delete ${deleteTarget?.fullName}? This action cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
