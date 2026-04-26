import { renderHook, act } from "@testing-library/react";
import { z } from "zod";
import { useZodForm, getFieldError } from "./useZodForm";

const testSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
});

describe("useZodForm", () => {
  it("returns useForm methods with zodResolver wired", () => {
    const { result } = renderHook(() =>
      useZodForm(testSchema, {
        defaultValues: { name: "", email: "" },
      })
    );

    expect(result.current.register).toBeDefined();
    expect(result.current.handleSubmit).toBeDefined();
    expect(result.current.formState).toBeDefined();
  });

  it("has no errors on initial render", () => {
    const { result } = renderHook(() =>
      useZodForm(testSchema, {
        defaultValues: { name: "", email: "" },
      })
    );

    expect(Object.keys(result.current.formState.errors)).toHaveLength(0);
  });

  it("detects validation errors after trigger", async () => {
    const { result } = renderHook(() =>
      useZodForm(testSchema, {
        defaultValues: { name: "", email: "bad" },
      })
    );

    await act(async () => {
      await result.current.trigger();
    });

    expect(result.current.formState.errors.name?.message).toBe("Name is required");
    expect(result.current.formState.errors.email?.message).toBe("Invalid email");
  });

  it("passes validation with valid data after trigger", async () => {
    const { result } = renderHook(() =>
      useZodForm(testSchema, {
        defaultValues: { name: "John", email: "john@example.com" },
      })
    );

    await act(async () => {
      await result.current.trigger();
    });

    expect(Object.keys(result.current.formState.errors)).toHaveLength(0);
  });
});

describe("getFieldError", () => {
  const errors = {
    name: { message: "Name is required" },
    email: { message: "Invalid email" },
  };

  it("returns error message for a field with an error", () => {
    expect(getFieldError(errors, "name" as never)).toBe("Name is required");
  });

  it("returns undefined for a field without an error", () => {
    expect(getFieldError(errors, "phone" as never)).toBeUndefined();
  });

  it("returns undefined for empty errors object", () => {
    expect(getFieldError({}, "name" as never)).toBeUndefined();
  });
});
