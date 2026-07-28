import { z } from "zod";

/**
 * Mirrors backend/src/auth/dto/register-auth.dto.ts
 * (class-validator: @IsEmail, @IsNotEmpty, @MinLength(6)).
 * Update this file when the backend DTO changes.
 */
export const passwordPolicy = z
  .string()
  .min(1, { message: "errors.password.required" })
  .min(6, { message: "errors.password.minLength" });

export const registerSchema = z.object({
  email: z.string().email({ message: "errors.email.invalid" }),
  password: passwordPolicy,
  fullName: z.string().min(1, { message: "errors.fullName.required" }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Mirrors backend/src/auth/dto/login-auth.dto.ts
 * (class-validator: @IsEmail, @IsNotEmpty).
 */
export const loginSchema = z.object({
  email: z.string().email({ message: "errors.email.invalid" }),
  password: z.string().min(1, { message: "errors.password.required" }),
});
export type LoginInput = z.infer<typeof loginSchema>;
