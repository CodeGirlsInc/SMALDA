import { z } from "zod";

/**
 * User profile preferences update. restricted language list mirrors
 * frontend/i18n/routing.ts locales.
 */
export const SUPPORTED_LANGUAGES = ["en", "fr", "es"] as const;

export const profileUpdateSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  preferredLanguage: z.enum(SUPPORTED_LANGUAGES).optional(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
