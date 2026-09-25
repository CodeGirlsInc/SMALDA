/**
 * Shared shape for a parcel/document as consumed by the map sidebar
 * (ParcelSidebar). Lives here so future consumers import this instead of
 * duplicating the shape inline.
 */
export type DocumentStatus = "VERIFIED" | "PENDING" | "FLAGGED" | "REJECTED";

export interface ParcelDocument {
  id: string;
  name: string;
  status: DocumentStatus;
  /** 0–100 */
  riskScore: number;
  ownerName: string | null;
  isOwnedByViewer: boolean;
  stellarAnchorDate: string | null;
  stellarTxHash: string | null;
  flags: string[];
  detailsUrl: string;
}
