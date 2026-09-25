import {
  normalizeAuthUser,
  normalizeDispute,
  normalizeDisputeList,
  normalizeDocumentList,
} from "./disputes";

const disputeFixture = {
  id: "dispute-1",
  documentId: "document-1",
  description: "The ownership information is incorrect.",
  reason: { id: "reason-1", name: "Incorrect information" },
  status: "open",
  filedBy: "user-1",
  createdAt: "2026-01-02T12:00:00.000Z",
};

const documentFixture = {
  id: "document-1",
  title: "Land Title",
  status: "verified",
  riskScore: 12,
  riskFlags: [],
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-02T12:00:00.000Z",
};

describe("dispute response boundaries", () => {
  it("normalizes the exact dispute list envelope", () => {
    const result = normalizeDisputeList({
      data: [disputeFixture],
      total: 1,
    });

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: "dispute-1",
      status: "open",
      reason: { id: "reason-1", name: "Incorrect information" },
      timeline: [],
      resolution: null,
      resolvedAt: null,
      document: null,
    });
  });

  it("normalizes the exact document list envelope", () => {
    const result = normalizeDocumentList({
      data: [documentFixture],
      total: 1,
      page: 1,
      limit: 20,
    });

    expect(result).toEqual({
      data: [
        {
          id: "document-1",
          title: "Land Title",
          status: "verified",
          riskScore: 12,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it("tolerates the detail DTO without optional enrichment", () => {
    expect(() => normalizeDispute(disputeFixture)).not.toThrow();
    expect(normalizeDispute(disputeFixture).document).toBeNull();
    expect(
      normalizeDispute({ ...disputeFixture, reason: "legacy reason" }).reason,
    ).toBeNull();
  });

  it("rejects an array where an envelope is required", () => {
    expect(() => normalizeDisputeList([disputeFixture])).toThrow(
      "Invalid dispute list response",
    );
    expect(() =>
      normalizeDocumentList({ documents: [documentFixture] }),
    ).toThrow("Invalid document list response");
  });

  it("normalizes the minimal authenticated user response", () => {
    expect(normalizeAuthUser({ id: "admin-1", role: "admin" })).toEqual({
      id: "admin-1",
      role: "admin",
    });
  });
});
