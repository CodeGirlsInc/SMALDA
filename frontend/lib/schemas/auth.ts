import { z } from "zod";
import { apiContracts } from "@/lib/api-contracts";

const registerContract = apiContracts.register;
const loginContract = apiContracts.login;

function contractEmailSchema(format: string, message: string) {
  if (format !== "email") {
    throw new Error(`Unsupported email format: ${format}`);
  }
  return z.string().email({ message });
}

export const passwordPolicy = z
  .string()
  .min(1, { message: "errors.password.required" })
  .min(registerContract.password.minLength, {
    message: "errors.password.minLength",
  });

export const registerSchema = z.object({
  email: contractEmailSchema(
    registerContract.email.format,
    "errors.email.invalid",
  ),
  password: passwordPolicy,
  fullName: z.string().min(registerContract.fullName.minLength, {
    message: "errors.fullName.required",
  }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: contractEmailSchema(
    loginContract.email.format,
    "errors.email.invalid",
  ),
  password: z.string().min(loginContract.password.minLength, {
    message: "errors.password.required",
  }),
});
export type LoginInput = z.infer<typeof loginSchema>;
