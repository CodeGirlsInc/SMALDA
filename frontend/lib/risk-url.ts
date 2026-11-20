import { apiUrl } from "@/lib/api-config";

/**
 * URL of a document's risk assessment, in the user's locale. The backend
 * (`GET /documents/:id/risk?lang=`) returns the localised flag descriptions
 * for `en`, `fr` and `es`; without `lang` they are always English.
 */
export function riskUrl(documentPath: string, locale: string): string {
  return apiUrl(`${documentPath}/risk`, { lang: locale });
}
