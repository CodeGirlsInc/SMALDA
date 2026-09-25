const mockDomPurifySanitize = jest.fn();

jest.mock("dompurify", () => ({
  __esModule: true,
  default: { sanitize: mockDomPurifySanitize },
}));

import { toPublicDocumentView } from "./document-mapper";

describe("toPublicDocumentView", () => {
  it("maps API records without loading the browser sanitizer", () => {
    const rawDocument = {
      id: "doc-1",
      documentHash: "0x123",
      isVerified: "false",
      ownerSecret: "private",
    };
    const result = toPublicDocumentView(rawDocument);

    expect(result.isVerified).toBe(false);
    expect(result.documentHash).toBe("0x123");
    expect((result as { ownerSecret?: string }).ownerSecret).toBeUndefined();
    expect(mockDomPurifySanitize).not.toHaveBeenCalled();
  });

  it("accepts only explicit truthy serialized values", () => {
    expect(
      toPublicDocumentView({ id: "1", documentHash: "0x1", isVerified: "true" })
        .isVerified,
    ).toBe(true);
    expect(
      toPublicDocumentView({ id: "2", documentHash: "0x2", isVerified: 1 })
        .isVerified,
    ).toBe(true);
  });
});
