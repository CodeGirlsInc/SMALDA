import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("notFound");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="text-sm text-gray-500">
        {t("description")}
      </p>
      <Link
        href="/"
        className="text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        {t("home")}
      </Link>
      <p className="mt-6 max-w-md text-xs text-gray-400">
        {t("docNotFoundDescription")}
      </p>
    </main>
  );
}
