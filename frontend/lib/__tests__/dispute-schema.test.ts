import { createDisputeSchema } from "@/lib/schemas/dispute";

const documentId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("createDisputeSchema description limits", () => {
  it("rejects a one-character description", () => {
    expect(createDisputeSchema.safeParse({ documentId, description: "x" }).success).toBe(false);
  });

  it("accepts a description of at least 20 characters", () => {
    expect(
      createDisputeSchema.safeParse({ documentId, description: "x".repeat(20) }).success,
    ).toBe(true);
  });

  it("rejects an oversized description", () => {
    expect(
      createDisputeSchema.safeParse({ documentId, description: "x".repeat(5001) }).success,
    ).toBe(false);
  });
});
