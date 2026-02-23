import { DocumentExpiry } from '../entities/document-expiry.entity';

export type ExpiryStatusLabel = 'EXPIRED' | 'EXPIRING_SOON' | 'VALID';

export interface ExpiryStatus {
  record: DocumentExpiry;
  /** Positive = days remaining; negative = days since expiry */
  daysUntilExpiry: number;
  /**
   * EXPIRED      — expiryDate is in the past
   * EXPIRING_SOON — within the renewalPeriodDays window
   * VALID         — comfortably within validity
   */
  status: ExpiryStatusLabel;
}
