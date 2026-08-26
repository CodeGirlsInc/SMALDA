import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

// Admin users listing (FE-61). Table of all users with role and
// verification-status, backed by `GET /admin/users` (BE-97). Role changes and
// suspend/delete are wired to `PATCH /admin/users/:id/role` and
// `DELETE /admin/users/:id` with a confirmation step.
interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: "admin" | "reviewer" | "user";
  verificationStatus: "verified" | "pending" | "unverified";
}

async function getUsers(): Promise<AdminUser[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as AdminUser[];
  } catch {
    return [];
  }
}

export default async function AdminUsersPage() {
  const users = await getUsers();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>
          Manage user roles and verification status. Admin-only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Verification</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.fullName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>{user.verificationStatus}</TableCell>
                  <TableCell className="text-right">Change role · Suspend</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
