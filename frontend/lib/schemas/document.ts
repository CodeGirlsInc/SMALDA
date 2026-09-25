import { z } from "zod";
import { apiContracts } from "@/lib/api-contracts";

export const documentUploadConstraints = apiContracts.documentUpload;

export const documentUploadSchema = z.object({
  fileSize: z
    .number()
    .int()
    .positive()
    .max(documentUploadConstraints.fileSize.max, {
      message: "errors.document.fileSize",
    }),
  mimeType: z.string().refine(
    (value) => documentUploadConstraints.mimeTypes.includes(value),
    { message: "errors.document.mimeFormat" },
  ),
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

export interface DocumentListItem {
  id: string;
  title: string;
  status: string;
  riskScore: number | null;
  riskFlags: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListResponse {
  data: DocumentListItem[];
  total: number;
  page: number;
  limit: number;
}
