import { requireAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function LocalizedAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdminSession(locale);
  return children;
}
