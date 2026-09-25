export const disputeStatuses = [
  "open",
  "in_review",
  "resolved",
  "dismissed",
] as const;

export type DisputeStatus = (typeof disputeStatuses)[number];

export interface DisputeReason {
  id: string;
  name: string;
}

export interface DisputeTimelineEntry {
  status: DisputeStatus;
  createdAt: string;
}

export interface DisputeDocument {
  title?: string;
  status?: string;
  riskScore?: number;
}

export interface Dispute {
  id: string;
  documentId: string;
  description: string;
  reason: DisputeReason | null;
  status: DisputeStatus;
  filedBy: string;
  createdAt: string;
  timeline: DisputeTimelineEntry[];
  resolution: string | null;
  resolvedAt: string | null;
  document: DisputeDocument | null;
}

export interface DisputeList {
  data: Dispute[];
  total: number;
}

export interface DisputeDocumentSummary {
  id: string;
  title: string;
  status?: string;
  riskScore?: number;
}

export interface DocumentList {
  data: DisputeDocumentSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface AuthUser {
  id: string;
  role: "admin" | "user";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid dispute response: ${key} must be a string`);
  }
  return value;
}

function disputeStatus(value: unknown): DisputeStatus {
  if (
    typeof value === "string" &&
    disputeStatuses.includes(value as DisputeStatus)
  ) {
    return value as DisputeStatus;
  }
  throw new Error("Invalid dispute response: unsupported status");
}

function disputeReason(value: unknown): DisputeReason | null {
  const record = asRecord(value);
  if (
    !record ||
    typeof record.id !== "string" ||
    typeof record.name !== "string"
  ) {
    return null;
  }
  return { id: record.id, name: record.name };
}

function disputeTimeline(value: unknown): DisputeTimelineEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const record = asRecord(entry);
    if (!record) return [];
    try {
      return [
        {
          status: disputeStatus(record.status),
          createdAt: requiredString(record, "createdAt"),
        },
      ];
    } catch {
      return [];
    }
  });
}

function disputeDocument(value: unknown): DisputeDocument | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    title: typeof record.title === "string" ? record.title : undefined,
    status: typeof record.status === "string" ? record.status : undefined,
    riskScore:
      typeof record.riskScore === "number" ? record.riskScore : undefined,
  };
}

export function normalizeDispute(value: unknown): Dispute {
  const record = asRecord(value);
  if (!record) throw new Error("Invalid dispute response");

  return {
    id: requiredString(record, "id"),
    documentId: requiredString(record, "documentId"),
    description:
      typeof record.description === "string" ? record.description : "",
    reason: disputeReason(record.reason),
    status: disputeStatus(record.status),
    filedBy: requiredString(record, "filedBy"),
    createdAt: requiredString(record, "createdAt"),
    timeline: disputeTimeline(record.timeline),
    resolution:
      typeof record.resolution === "string" ? record.resolution : null,
    resolvedAt:
      typeof record.resolvedAt === "string" ? record.resolvedAt : null,
    document: disputeDocument(record.document),
  };
}

export function normalizeDisputeList(value: unknown): DisputeList {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.data)) {
    throw new Error("Invalid dispute list response");
  }

  const data = record.data.map(normalizeDispute);
  return {
    data,
    total: typeof record.total === "number" ? record.total : data.length,
  };
}

export function normalizeDocumentList(value: unknown): DocumentList {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.data)) {
    throw new Error("Invalid document list response");
  }

  const data = record.data.flatMap((value) => {
    const document = asRecord(value);
    if (
      !document ||
      typeof document.id !== "string" ||
      typeof document.title !== "string"
    ) {
      return [];
    }
    return [
      {
        id: document.id,
        title: document.title,
        status:
          typeof document.status === "string" ? document.status : undefined,
        riskScore:
          typeof document.riskScore === "number"
            ? document.riskScore
            : undefined,
      },
    ];
  });

  return {
    data,
    total: typeof record.total === "number" ? record.total : data.length,
    page: typeof record.page === "number" ? record.page : 1,
    limit: typeof record.limit === "number" ? record.limit : data.length,
  };
}

export function normalizeAuthUser(value: unknown): AuthUser {
  const record = asRecord(value);
  if (
    !record ||
    typeof record.id !== "string" ||
    (record.role !== "admin" && record.role !== "user")
  ) {
    throw new Error("Invalid authenticated user response");
  }
  return { id: record.id, role: record.role };
}

export function disputeStatusLabel(status: DisputeStatus): string {
  return status.replace("_", " ");
}
