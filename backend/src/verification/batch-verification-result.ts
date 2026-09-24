/**
 * Per-check batch verification result, replacing the previous
 * all-or-nothing failure model in verification.service.
 */
export interface CheckResult {
  name: string;
  passed: boolean;
  reason?: string;
}

export interface BatchVerificationResult {
  overallPassed: boolean;
  checks: CheckResult[];
}

export function buildBatchResult(checks: CheckResult[]): BatchVerificationResult {
  return {
    overallPassed: checks.every((check) => check.passed),
    checks,
  };
}
