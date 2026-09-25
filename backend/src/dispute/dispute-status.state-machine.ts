import {
  ALLOWED_DISPUTE_TRANSITIONS,
  DisputeStatus,
} from './entities/dispute.entity';

export function canTransition(from: DisputeStatus, to: DisputeStatus): boolean {
  return ALLOWED_DISPUTE_TRANSITIONS[from]?.includes(to) ?? false;
}
