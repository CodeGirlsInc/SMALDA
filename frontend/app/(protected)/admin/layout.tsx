import { requireAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminSession("en");
  return children;
}
