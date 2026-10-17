/**
 * Dispute route + resolution constants (#1492).
 *
 * Defines the reassign and withdraw (DELETE) routes, the admin listing path and
 * the resolution states, so the new endpoints agree on a single vocabulary.
 */
export interface DisputeRoute {
  method: "POST" | "DELETE" | "GET" | "PATCH";
  path: string;
}

export const DISPUTE_ROUTES: Readonly<Record<string, DisputeRoute>> =
  Object.freeze({
    reassign: { method: "POST", path: "disputes/:id/reassign" },
    withdraw: { method: "DELETE", path: "disputes/:id" },
    adminList: { method: "GET", path: "admin/disputes" },
    resolve: { method: "PATCH", path: "disputes/:id/resolve" },
  });

export type DisputeResolution = "UPHELD" | "REJECTED" | "WITHDRAWN";

export const DISPUTE_RESOLUTIONS: readonly DisputeResolution[] = [
  "UPHELD",
  "REJECTED",
  "WITHDRAWN",
];

/** Whether a resolution requires a non-empty note (#1492). */
export function requiresResolutionNote(resolution: DisputeResolution): boolean {
  return resolution !== "WITHDRAWN";
}
