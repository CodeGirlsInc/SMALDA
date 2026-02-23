import { Injectable } from '@nestjs/common';
import { RiskIndicatorService } from '../risk-indicator/risk-indicator.service';
import { RiskIndicatorSeverity } from '../risk-indicator/enums/risk-indicator.enum';
import {
  RiskLevel,
  RiskScoreResult,
} from './interfaces/risk-score-result.interface';

const WEIGHTS: Record<RiskIndicatorSeverity, number> = {
  [RiskIndicatorSeverity.CRITICAL]: 30,
  [RiskIndicatorSeverity.HIGH]: 15,
  [RiskIndicatorSeverity.MEDIUM]: 7,
  [RiskIndicatorSeverity.LOW]: 2,
};

const CRITICAL_CAP = 90;

function resolveRiskLevel(score: number): RiskLevel {
  if (score === 0) return 'NONE';
  if (score <= 25) return 'LOW';
  if (score <= 50) return 'MEDIUM';
  if (score <= 75) return 'HIGH';
  return 'CRITICAL';
}

@Injectable()
export class RiskScoreService {
  constructor(private readonly riskIndicatorService: RiskIndicatorService) {}

  async computeScore(documentId: string): Promise<RiskScoreResult> {
    const allIndicators =
      await this.riskIndicatorService.findByDocument(documentId);

    const unresolved = allIndicators.filter((i) => !i.isResolved);

    const breakdown = { low: 0, medium: 0, high: 0, critical: 0 };

    for (const indicator of unresolved) {
      switch (indicator.severity) {
        case RiskIndicatorSeverity.LOW:
          breakdown.low++;
          break;
        case RiskIndicatorSeverity.MEDIUM:
          breakdown.medium++;
          break;
        case RiskIndicatorSeverity.HIGH:
          breakdown.high++;
          break;
        case RiskIndicatorSeverity.CRITICAL:
          breakdown.critical++;
          break;
      }
    }

    const criticalScore = Math.min(
      breakdown.critical * WEIGHTS[RiskIndicatorSeverity.CRITICAL],
      CRITICAL_CAP,
    );
    const highScore = breakdown.high * WEIGHTS[RiskIndicatorSeverity.HIGH];
    const mediumScore =
      breakdown.medium * WEIGHTS[RiskIndicatorSeverity.MEDIUM];
    const lowScore = breakdown.low * WEIGHTS[RiskIndicatorSeverity.LOW];

    const raw = criticalScore + highScore + mediumScore + lowScore;
    const score = Math.min(Math.max(raw, 0), 100);

    return {
      documentId,
      score,
      riskLevel: resolveRiskLevel(score),
      indicatorCount: unresolved.length,
      breakdown,
      computedAt: new Date(),
    };
  }
}
