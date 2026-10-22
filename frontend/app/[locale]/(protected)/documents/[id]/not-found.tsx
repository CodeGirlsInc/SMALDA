import {
  getLocale,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { NotFoundContent } from "@/components/NotFoundContent";
import { routing } from "@/i18n/routing";

/**
 * Scoped not-found for the document detail route. A missing hash means no
 * record was ever anchored, not that the verifier adjudicated and rejected it.
 */
export default async function DocumentNotFound() {
  const locale = await getLocale();
  setRequestLocale(locale);

  const t = await getTranslations("notFound");
  const homeHref = locale === routing.defaultLocale ? "/" : `/${locale}`;

  return (
    <NotFoundContent
      description={t("docNotFound")}
      homeLabel={t("home")}
      homeHref={homeHref}
      dashboardHref={homeHref}
      dashboardLabel={t("dashboardHome")}
      detailDescription={t("docNotFoundDescription")}
    />
  );
}
