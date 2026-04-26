import {
  loginSchema,
  registerSchema,
  passwordChangeSchema,
  passwordResetSchema,
  forgotPasswordSchema,
} from "./schemas";

// ─── loginSchema ─────────────────────────────────────────────────────────────

describe("loginSchema", () => {
  it("accepts valid login data", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "Password1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const result = loginSchema.safeParse({
      email: "",
      password: "Password1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.find((i) => i.path[0] === "email")?.message).toBe(
        "Email is required"
      );
    }
  });

  it("rejects invalid email format", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "Password1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find((i) => i.path[0] === "email");
      expect(emailIssue?.message).toContain("valid email");
    }
  });

  it("rejects missing password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.find((i) => i.path[0] === "password")?.message).toBe(
        "Password is required"
      );
    }
  });

  it("rejects password shorter than 8 characters", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "Pass1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pwIssue = result.error.issues.find((i) => i.path[0] === "password");
      expect(pwIssue?.message).toContain("8 characters");
    }
  });

  it("rejects completely empty object", () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ─── registerSchema ──────────────────────────────────────────────────────────

describe("registerSchema", () => {
  const validData = {
    fullName: "John Doe",
    email: "john@example.com",
    password: "Password1",
    confirmPassword: "Password1",
  };

  it("accepts valid registration data", () => {
    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects missing full name", () => {
    const result = registerSchema.safeParse({ ...validData, fullName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.find((i) => i.path[0] === "fullName")?.message).toBe(
        "Full name is required"
      );
    }
  });

  it("rejects full name shorter than 2 characters", () => {
    const result = registerSchema.safeParse({ ...validData, fullName: "J" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameIssue = result.error.issues.find((i) => i.path[0] === "fullName");
      expect(nameIssue?.message).toContain("2 characters");
    }
  });

  it("rejects full name longer than 100 characters", () => {
    const result = registerSchema.safeParse({
      ...validData,
      fullName: "A".repeat(101),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameIssue = result.error.issues.find((i) => i.path[0] === "fullName");
      expect(nameIssue?.message).toContain("100 characters");
    }
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({ ...validData, email: "bad-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find((i) => i.path[0] === "email");
      expect(emailIssue?.message).toContain("valid email");
    }
  });

  it("rejects password without uppercase letter", () => {
    const result = registerSchema.safeParse({
      ...validData,
      password: "password1",
      confirmPassword: "password1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pwIssue = result.error.issues.find((i) => i.path[0] === "password");
      expect(pwIssue?.message).toContain("uppercase");
    }
  });

  it("rejects password without lowercase letter", () => {
    const result = registerSchema.safeParse({
      ...validData,
      password: "PASSWORD1",
      confirmPassword: "PASSWORD1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pwIssue = result.error.issues.find((i) => i.path[0] === "password");
      expect(pwIssue?.message).toContain("lowercase");
    }
  });

  it("rejects password without a digit", () => {
    const result = registerSchema.safeParse({
      ...validData,
      password: "PasswordXYZ",
      confirmPassword: "PasswordXYZ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pwIssue = result.error.issues.find((i) => i.path[0] === "password");
      expect(pwIssue?.message).toContain("number");
    }
  });

  it("rejects password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      ...validData,
      password: "Pass1",
      confirmPassword: "Pass1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched confirm password", () => {
    const result = registerSchema.safeParse({
      ...validData,
      confirmPassword: "Different1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const confirmIssue = result.error.issues.find(
        (i) => i.path[0] === "confirmPassword"
      );
      expect(confirmIssue?.message).toContain("do not match");
    }
  });

  it("rejects missing confirm password", () => {
    const result = registerSchema.safeParse({
      ...validData,
      confirmPassword: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const confirmIssue = result.error.issues.find(
        (i) => i.path[0] === "confirmPassword"
      );
      expect(confirmIssue?.message).toBe("Please confirm your password");
    }
  });
});

// ─── passwordChangeSchema ────────────────────────────────────────────────────

describe("passwordChangeSchema", () => {
  const validData = {
    currentPassword: "OldPassword1",
    newPassword: "NewPassword1",
    confirmNewPassword: "NewPassword1",
  };

  it("accepts valid password change data", () => {
    const result = passwordChangeSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects missing current password", () => {
    const result = passwordChangeSchema.safeParse({
      ...validData,
      currentPassword: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "currentPassword");
      expect(issue?.message).toBe("Current password is required");
    }
  });

  it("rejects new password without required character types", () => {
    const result = passwordChangeSchema.safeParse({
      ...validData,
      newPassword: "newpassword",
      confirmNewPassword: "newpassword",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "newPassword");
      expect(issue?.message).toContain("uppercase");
    }
  });

  it("rejects mismatched confirm new password", () => {
    const result = passwordChangeSchema.safeParse({
      ...validData,
      confirmNewPassword: "DifferentPassword1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === "confirmNewPassword"
      );
      expect(issue?.message).toContain("do not match");
    }
  });

  it("rejects new password same as current password", () => {
    const result = passwordChangeSchema.safeParse({
      ...validData,
      newPassword: "OldPassword1",
      confirmNewPassword: "OldPassword1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "newPassword");
      expect(issue?.message).toContain("different from current");
    }
  });

  it("rejects new password shorter than 8 characters", () => {
    const result = passwordChangeSchema.safeParse({
      ...validData,
      newPassword: "New1",
      confirmNewPassword: "New1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "newPassword");
      expect(issue?.message).toContain("8 characters");
    }
  });
});

// ─── passwordResetSchema ─────────────────────────────────────────────────────

describe("passwordResetSchema", () => {
  const validData = {
    newPassword: "NewPassword1",
    confirmPassword: "NewPassword1",
  };

  it("accepts valid reset data", () => {
    const result = passwordResetSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects missing new password", () => {
    const result = passwordResetSchema.safeParse({
      ...validData,
      newPassword: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "newPassword");
      expect(issue?.message).toBe("New password is required");
    }
  });

  it("rejects new password shorter than 8 characters", () => {
    const result = passwordResetSchema.safeParse({
      ...validData,
      newPassword: "Pass1",
      confirmPassword: "Pass1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "newPassword");
      expect(issue?.message).toContain("8 characters");
    }
  });

  it("rejects new password without uppercase letter", () => {
    const result = passwordResetSchema.safeParse({
      ...validData,
      newPassword: "newpassword1",
      confirmPassword: "newpassword1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "newPassword");
      expect(issue?.message).toContain("uppercase");
    }
  });

  it("rejects new password without lowercase letter", () => {
    const result = passwordResetSchema.safeParse({
      ...validData,
      newPassword: "NEWPASSWORD1",
      confirmPassword: "NEWPASSWORD1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "newPassword");
      expect(issue?.message).toContain("lowercase");
    }
  });

  it("rejects new password without a digit", () => {
    const result = passwordResetSchema.safeParse({
      ...validData,
      newPassword: "NewPassword",
      confirmPassword: "NewPassword",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "newPassword");
      expect(issue?.message).toContain("number");
    }
  });

  it("rejects mismatched confirm password", () => {
    const result = passwordResetSchema.safeParse({
      ...validData,
      confirmPassword: "DifferentPassword1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "confirmPassword");
      expect(issue?.message).toContain("do not match");
    }
  });

  it("rejects missing confirm password", () => {
    const result = passwordResetSchema.safeParse({
      ...validData,
      confirmPassword: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "confirmPassword");
      expect(issue?.message).toBe("Please confirm your password");
    }
  });
});

// ─── forgotPasswordSchema ────────────────────────────────────────────────────

describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "email");
      expect(issue?.message).toBe("Email is required");
    }
  });

  it("rejects invalid email format", () => {
    const result = forgotPasswordSchema.safeParse({ email: "not-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "email");
      expect(issue?.message).toContain("valid email");
    }
  });

  it("rejects email without domain", () => {
    const result = forgotPasswordSchema.safeParse({ email: "user@" });
    expect(result.success).toBe(false);
  });

  it("rejects completely empty object", () => {
    const result = forgotPasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
