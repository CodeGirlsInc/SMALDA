import { z } from "zod";

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "auth.register.errors.fullNameMin"),

    email: z
      .string()
      .email("auth.register.errors.emailInvalid"),

    password: z
      .string()
      .min(8, "auth.register.errors.passwordMin")
      .regex(/[A-Z]/, "auth.register.errors.passwordUppercase")
      .regex(/[a-z]/, "auth.register.errors.passwordLowercase")
      .regex(/[0-9]/, "auth.register.errors.passwordNumber")
      .regex(/[^A-Za-z0-9]/, "auth.register.errors.passwordSpecial"),

    confirmPassword: z
      .string()
      .min(1, "auth.register.errors.confirmRequired"),
  })
  .refine(
    data => data.password === data.confirmPassword,
    {
      path: ["confirmPassword"],
      message: "auth.register.errors.passwordMismatch",
    }
  );

export type RegisterFormValues =
  z.infer<typeof registerSchema>;
