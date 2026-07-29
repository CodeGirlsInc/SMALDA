import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import NotificationBell from "@/components/layout/NotificationBell";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = resolvedParams?.locale ?? "en";
  setRequestLocale(locale);

  const t = await getTranslations("nav");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-bold text-gray-900">
              SMALDA
            </Link>
            <div className="hidden items-center gap-4 sm:flex">
              <Link
                href="/"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                {t("dashboard")}
              </Link>
              <Link
                href="/documents"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                {t("documents")}
              </Link>
              <Link
                href="/admin"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Admin
              </Link>
              <Link
                href="/settings"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                {t("settings")}
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <LanguageSwitcher />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
