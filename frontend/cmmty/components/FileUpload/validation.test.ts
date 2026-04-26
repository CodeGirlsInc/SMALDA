import { validateFile } from "./validation";

describe("validateFile", () => {
  it("rejects unsupported MIME types", () => {
    const file = new File(["content"], "notes.txt", { type: "text/plain" });
    const result = validateFile(file, ["application/pdf"], 1024);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toMatch(/unsupported file type/i);
  });

  it("rejects files larger than max", () => {
    const file = new File([new Uint8Array(2048)], "large.pdf", { type: "application/pdf" });
    const result = validateFile(file, ["application/pdf"], 1024);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toMatch(/exceeds max size/i);
  });

  it("accepts valid files", () => {
    const file = new File(["content"], "doc.pdf", { type: "application/pdf" });
    const result = validateFile(file, ["application/pdf"], 1024 * 1024);

    expect(result.isValid).toBe(true);
  });
});
