import {
  getLocale,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { NotFoundContent } from "@/components/NotFoundContent";
import { routing } from "@/i18n/routing";

export default async function NotFound() {
  const locale = await getLocale();
  setRequestLocale(locale);

  const t = await getTranslations("notFound");
  const homeHref = locale === routing.defaultLocale ? "/" : `/${locale}`;

  return (
    <NotFoundContent
      description={t("description")}
      homeLabel={t("home")}
      homeHref={homeHref}
      dashboardHref={homeHref}
      dashboardLabel={t("dashboardHome")}
      detailDescription={t("docNotFoundDescription")}
    />
  );
}
