import { getTranslations, setRequestLocale } from "next-intl/server";
import { NotFoundContent } from "@/components/NotFoundContent";

export default async function NotFound({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = resolvedParams?.locale ?? "en";
  setRequestLocale(locale);

  const t = await getTranslations("notFound");

  return (
    <NotFoundContent
      description={t("description")}
      homeLabel={t("home")}
      homeHref={locale === "en" ? "/" : `/${locale}`}
      detailDescription={t("docNotFoundDescription")}
    />
  );
}
