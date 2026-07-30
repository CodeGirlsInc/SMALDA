import { z } from "zod";

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Full name is required"),

    email: z
      .string()
      .email("Invalid email address"),

    password: z
      .string()
      .min(8)
      .regex(/[A-Z]/)
      .regex(/[a-z]/)
      .regex(/[0-9]/)
      .regex(/[^A-Za-z0-9]/),

    confirmPassword: z.string(),
  })
  .refine(
    data => data.password === data.confirmPassword,
    {
      path: ["confirmPassword"],
      message: "Passwords do not match",
    }
  );

export type RegisterFormValues =
  z.infer<typeof registerSchema>;