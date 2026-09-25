import { z } from "zod";
import { apiContracts } from "@/lib/api-contracts";

const disputeContract = apiContracts.dispute;

function contractUuidSchema(format: string, message?: string) {
  if (format !== "uuid") {
    throw new Error(`Unsupported UUID format: ${format}`);
  }
  return message ? z.string().uuid({ message }) : z.string().uuid();
}

export const DISPUTE_DESCRIPTION_UX_MIN_LENGTH = 20;
export const disputeStatusValues = disputeContract.statuses;

export type DisputeStatus =
  | "open"
  | "in_review"
  | "resolved"
  | "dismissed";

export const disputeStatusSchema = z.custom<DisputeStatus>(
  (value) =>
    typeof value === "string" && disputeStatusValues.includes(value),
  { message: "errors.dispute.status" },
);

export const createDisputeSchema = z.object({
  documentId: contractUuidSchema(
    disputeContract.documentId.format,
    "errors.dispute.documentIdUuid",
  ),
  description: z.string().min(disputeContract.description.minLength, {
    message: "errors.dispute.descriptionRequired",
  }),
});

export const disputeReasonSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});

export const disputeResponseSchema = z.object({
  id: z.string().uuid(),
  documentId: contractUuidSchema(disputeContract.documentId.format),
  description: z.string().min(disputeContract.description.minLength),
  reason: disputeReasonSchema.nullable(),
  status: disputeStatusSchema,
  filedBy: z.string().uuid(),
  createdAt: z.string(),
});

export const disputeListResponseSchema = z.object({
  data: z.array(disputeResponseSchema),
  total: z.number().int().nonnegative(),
});

export type DisputeReason = z.infer<typeof disputeReasonSchema>;
export type DisputeResponse = z.infer<typeof disputeResponseSchema>;
export type DisputeListResponse = z.infer<typeof disputeListResponseSchema>;
export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;
