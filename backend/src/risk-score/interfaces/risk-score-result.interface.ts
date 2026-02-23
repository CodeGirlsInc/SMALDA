export type RiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskScoreBreakdown {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface RiskScoreResult {
  documentId: string;
  score: number;
  riskLevel: RiskLevel;
  indicatorCount: number;
  breakdown: RiskScoreBreakdown;
  computedAt: Date;
}
