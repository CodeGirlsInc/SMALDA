/**
 * Explicit state machine guarding dispute status transitions, preventing
 * arbitrary moves such as resolved -> open with no guard rails.
 */
export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'closed';

const ALLOWED_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  open: ['under_review', 'closed'],
  under_review: ['resolved', 'open'],
  resolved: ['closed'],
  closed: [],
};

export function canTransition(from: DisputeStatus, to: DisputeStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
