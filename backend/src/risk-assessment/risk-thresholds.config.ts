/**
 * Configurable risk score thresholds, keyed by document type.
 * Replaces the previously hardcoded numeric thresholds in
 * risk-assessment.service so limits can be tuned without a code change.
 */
export interface RiskThresholds {
  low: number;
  medium: number;
  high: number;
}

const DEFAULT_THRESHOLDS: RiskThresholds = {
  low: 30,
  medium: 60,
  high: 85,
};

const THRESHOLDS_BY_DOCUMENT_TYPE: Record<string, RiskThresholds> = {
  contract: { low: 25, medium: 55, high: 80 },
  invoice: { low: 35, medium: 65, high: 90 },
};

export function getRiskThresholds(documentType?: string): RiskThresholds {
  if (documentType && THRESHOLDS_BY_DOCUMENT_TYPE[documentType]) {
    return THRESHOLDS_BY_DOCUMENT_TYPE[documentType];
  }
  return DEFAULT_THRESHOLDS;
}
