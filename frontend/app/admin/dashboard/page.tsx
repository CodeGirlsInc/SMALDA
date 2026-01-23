
// IMPORTANT:
// Add your auth guard here (server-side).

import AdminDashboardClient from "@/components/admin/dashboard/AdminDashboardClient";

// Example below is placeholder.
async function getSessionUser() {
  // Replace with your real session fetch:
  return { id: "1", email: "admin@test.com", role: "admin" as const };
}

export default async function AdminDashboardPage() {
  const user = await getSessionUser();

  if (user.role !== "admin") {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Access Denied</h1>
        <p className="text-sm text-gray-600 mt-2">
          Only admins can access this dashboard.
        </p>
      </div>
    );
  }

  return <AdminDashboardClient />;
}
