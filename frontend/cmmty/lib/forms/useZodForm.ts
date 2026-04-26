"use client";

import { useForm, UseFormProps, FieldValues, Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ZodSchema } from "zod";

/**
 * A helper hook that wires React Hook Form with a Zod schema resolver.
 *
 * Usage:
 * ```tsx
 * const { register, handleSubmit, formState: { errors } } = useZodForm(loginSchema, {
 *   defaultValues: { email: "", password: "" },
 * });
 * ```
 */
export function useZodForm<T extends FieldValues>(
  schema: ZodSchema<T>,
  props?: Omit<UseFormProps<T>, "resolver">
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useForm<T>({
    resolver: zodResolver(schema as any),
    ...props,
  });
}

/**
 * Helper to extract the error message for a specific field from formState.errors.
 * Returns the first error message string or undefined.
 */
export function getFieldError<T extends FieldValues>(
  errors: Record<string, { message?: string }>,
  field: Path<T>
): string | undefined {
  return errors[field]?.message;
}
