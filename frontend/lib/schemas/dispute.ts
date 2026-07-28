import { z } from "zod";

/**
 * Mirrors backend/src/dispute/dto/create-dispute.dto.ts
 * (class-validator: @IsUUID on documentId, @IsString + @IsNotEmpty on description).
 */
export const createDisputeSchema = z.object({
  documentId: z.string().uuid({ message: "errors.dispute.documentIdUuid" }),
  description: z
    .string()
    .min(1, { message: "errors.dispute.descriptionRequired" })
    .max(2000),
});
export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;
