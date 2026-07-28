import { z } from "zod";

/**
 * Client-side upload payload. Mirrors backend/src/documents/entities/document.entity.ts
 * writable fields (title, fileHash, fileSize, mimeType). Status / risk_score / riskFlags
 * are computed server-side and never validated from the client.
 *
 * NOTE: fileHash is sha256 hex, exactly 64 chars (matches contract HashValidator).
 */
export const documentUploadSchema = z.object({
  title: z.string().min(1, { message: "errors.document.titleRequired" }).max(255),
  fileHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, { message: "errors.document.hashFormat" }),
  fileSize: z.number().int().positive().max(100 * 1024 * 1024),
  mimeType: z
    .string()
    .regex(/^[a-z]+\/[a-z0-9.+-]+$/i, { message: "errors.document.mimeFormat" }),
});
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;

export const documentStatusSchema = z.enum([
  "pending",
  "analyzing",
  "verified",
  "flagged",
  "rejected",
]);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;
