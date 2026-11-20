"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { ApiError, request } from "@/lib/api-client";
import { apiUrl } from "@/lib/api-config";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserRole = "user" | "admin";

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string | null;
}

interface PaginatedUsers {
  data: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.backendMessage ?? fallback : fallback;
}

// ---------------------------------------------------------------------------
// Delete confirmation modal
// ---------------------------------------------------------------------------

interface DeleteModalProps {
  user: AdminUser;
  onConfirm: (email: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}

function DeleteModal({ user, onConfirm, onCancel, isLoading, error }: DeleteModalProps) {
  const [inputEmail, setInputEmail] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-user-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-6 space-y-4">
        <h2 id="delete-user-title" className="text-lg font-semibold text-red-700">
          Delete user account
        </h2>
        <p className="text-sm text-gray-700">
          Type <strong>{user.email}</strong> to confirm deletion of{" "}
          <strong>{user.fullName}</strong>. This cannot be undone.
        </p>
        <input
          ref={ref}
          type="email"
          value={inputEmail}
          onChange={(e) => setInputEmail(e.target.value)}
          placeholder={user.email}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          autoComplete="off"
          aria-label="Type the user's email to confirm deletion"
        />
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={isLoading}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-400">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(inputEmail)}
            disabled={inputEmail !== user.email || isLoading}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500">
            {isLoading ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  // Bulk select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Role-change confirmation
  const [roleConfirmation, setRoleConfirmation] = useState<{
    user: AdminUser;
    newRole: UserRole;
  } | null>(null);

  // Inline action loading
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // ── Check admin access ──────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    request<{ id: string; role: string }>(apiUrl("/auth/me"))
      .then((me) => {
        if (cancelled) return;
        setCurrentUserId(me.id);
        if (me.role !== "admin") router.replace("/");
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => { cancelled = true; };
  }, [router]);

  // ── Fetch users ─────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (roleFilter) params.set("role", roleFilter);
    if (appliedSearch) params.set("search", appliedSearch);

    try {
      const json = await request<PaginatedUsers>(apiUrl("/users", params));
      setUsers(json.data);
      setTotal(json.total);
      setSelected(new Set());
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, appliedSearch]);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  // ── Role change ─────────────────────────────────────────────────────────

  async function applyRoleChange(user: AdminUser, newRole: UserRole) {
    setActionLoading((prev) => ({ ...prev, [`role_${user.id}`]: true }));
    try {
      const updated = await request<AdminUser | null>(
        apiUrl(`/users/${user.id}`),
        { method: "PATCH", body: { role: newRole } },
      );
      setUsers((prev) => prev.map((u) =>
        u.id === user.id ? { ...u, role: updated?.role ?? newRole } : u
      ));
      toast({ title: "Role updated", variant: "success" });
    } catch (err: unknown) {
      toast({
        title: "Role update failed",
        description: errorMessage(err, "Role update failed"),
        variant: "destructive",
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, [`role_${user.id}`]: false }));
    }
  }

  function handleRoleChange(user: AdminUser, newRole: UserRole) {
    if (user.id === currentUserId && newRole !== user.role) {
      setRoleConfirmation({ user, newRole });
      return;
    }
    void applyRoleChange(user, newRole);
  }

  // ── Delete single ───────────────────────────────────────────────────────

  async function handleDeleteConfirm(typedEmail: string) {
    if (!deleteTarget || typedEmail !== deleteTarget.email) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await request(apiUrl(`/users/${deleteTarget.id}`), { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      const message = errorMessage(err, "Delete failed");
      setDeleteError(message);
      toast({ title: "Delete failed", description: message, variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Bulk delete ─────────────────────────────────────────────────────────

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          request(apiUrl(`/users/${id}`), { method: "DELETE" })
        )
      );
      setUsers((prev) => prev.filter((u) => !selected.has(u.id)));
      setSelected(new Set());
      setConfirmBulkDelete(false);
      toast({ title: "Users deleted", variant: "success" });
    } catch (err: unknown) {
      toast({
        title: "Delete failed",
        description: errorMessage(err, "Delete failed"),
        variant: "destructive",
      });
    } finally {
      setBulkDeleting(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      {deleteTarget && (
        <DeleteModal
          user={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => { setDeleteTarget(null); setDeleteError(null); }}
          isLoading={deleteLoading}
          error={deleteError}
        />
      )}

      <Dialog
        open={roleConfirmation !== null}
        onOpenChange={(open) => { if (!open) setRoleConfirmation(null); }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Change your own role?</DialogTitle>
            <DialogDescription>
              Changing your own role will remove your admin access. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRoleConfirmation(null)}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const target = roleConfirmation;
                setRoleConfirmation(null);
                if (target) void applyRoleChange(target.user, target.newRole);
              }}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Continue
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete selected users?</DialogTitle>
            <DialogDescription>
              Delete {selected.size} selected user(s)? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmBulkDelete(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              disabled={bulkDeleting}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {bulkDeleting ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="role-filter" className="block text-xs font-medium text-gray-600 mb-1">Role</label>
            <select id="role-filter" value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label htmlFor="search" className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <div className="flex gap-2">
              <input id="search" type="text" value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setAppliedSearch(search); setPage(1); } }}
                placeholder="Name or email…"
                className="border border-gray-300 rounded px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={() => { setAppliedSearch(search); setPage(1); }}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                Search
              </button>
            </div>
          </div>
          {selected.size > 0 && (
            <button onClick={() => setConfirmBulkDelete(true)} disabled={bulkDeleting}
              className="ml-auto px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500">
              {bulkDeleting ? "Deleting…" : `Delete ${selected.size} selected`}
            </button>
          )}
        </div>

        {/* ── Loading / Error ───────────────────────────────────────────── */}
        {loading && <p className="text-sm text-gray-500" role="status">Loading users…</p>}
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {!loading && !error && users.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">No users match the current filters.</p>
          </div>
        )}

        {/* ── Table ────────────────────────────────────────────────────── */}
        {!loading && users.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    <input type="checkbox"
                      checked={selected.size === users.length}
                      onChange={(e) => setSelected(e.target.checked ? new Set(users.map((u) => u.id)) : new Set())}
                      aria-label="Select all users" />
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-gray-600">Role</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-gray-600">Last login</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <input type="checkbox"
                        checked={selected.has(user.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          e.target.checked ? next.add(user.id) : next.delete(user.id);
                          setSelected(next);
                        }}
                        aria-label={`Select ${user.fullName}`} />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{user.fullName}</td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      {actionLoading[`role_${user.id}`] ? (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" aria-label="Updating role…" />
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                          className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          aria-label={`Role for ${user.fullName}`}>
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 items-center justify-end">
                        <button
                          onClick={() => { setDeleteTarget(user); setDeleteError(null); }}
                          className="text-xs text-red-600 hover:text-red-800 underline focus:outline-none focus:ring-1 focus:ring-red-500 rounded"
                          aria-label={`Delete ${user.fullName}`}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
            <p className="text-gray-600">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                Previous
              </button>
              <span className="px-3 py-1 text-gray-700">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                Next
              </button>
            </div>
          </nav>
        )}
      </main>
    </>
  );
}
