import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const STAT_KEYS = ["total", "verified", "flagged", "pending"] as const;

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("dashboard");

  return (
    <main id="main-content" aria-labelledby="dashboard-heading" className="mx-auto max-w-4xl px-4 py-8">
      <h1 id="dashboard-heading" className="sr-only">{t("title")}</h1>
      <header className="mb-8">
        <p className="text-sm font-medium text-blue-600">{t("welcome")}</p>
        <h2 className="mt-1 text-2xl font-bold text-gray-900">{t("title")}</h2>
        <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
      </header>

      {/* Stat cards — values are wired to the API in a later ticket. */}
      <section
        aria-label={t("title")}
        aria-live="polite"
        aria-atomic="true"
        className="grid grid-cols-2 gap-4 sm:grid-cols-4"
      >
        {STAT_KEYS.map((key) => (
          <div
            key={key}
            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <p className="text-2xl font-bold text-gray-900" aria-hidden="true">—</p>
            <p className="mt-1 text-xs font-medium text-gray-500">
              {t(`stats.${key}`)}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-gray-900">
          {t("quickActions")}
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/documents"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {t("uploadDocument")}
          </Link>
          <Link
            href="/admin/documents"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            {t("viewDocuments")}
          </Link>
        </div>
      </section>
    </main>
  );
}
