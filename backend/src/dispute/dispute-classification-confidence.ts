/**
 * Confidence threshold guard for the dispute reason classifier so
 * low-confidence predictions are flagged for manual review instead of
 * being auto-applied.
 */
export const CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.7;

export interface ClassificationResult {
  label: string;
  confidence: number;
}

export function requiresManualReview(result: ClassificationResult): boolean {
  return result.confidence < CLASSIFICATION_CONFIDENCE_THRESHOLD;
}
