import { cn } from "../utils";

describe("cn", () => {
  it("joins plain class strings", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  it("supports conditional object syntax", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });

  it("lets a later Tailwind class win over an earlier conflicting one", () => {
    expect(cn("bg-primary", "bg-red-500")).toBe("bg-red-500");
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("keeps non-conflicting Tailwind classes", () => {
    expect(cn("rounded-md bg-primary", "text-sm")).toBe("rounded-md bg-primary text-sm");
  });
});
