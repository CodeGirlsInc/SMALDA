import { Injectable } from '@nestjs/common';
import { EvaluateRiskDto, CourtCaseDto, EncumbranceDto } from './dto/evaluate-risk.dto';
import { RiskResponseDto } from './dto/risk-response.dto';

@Injectable()
export class RiskService {
  evaluate(input: EvaluateRiskDto): RiskResponseDto {
    let score = 0;
    const reasons: string[] = [];

    // Parties
    const parties = input.parties || [];
    if (parties.length > 4) {
      score += 10;
      reasons.push('Unusually many parties involved');
    }
    if (parties.some(p => ['unknown', 'agent'].includes((p.role || '').toLowerCase()))) {
      score += 8;
      reasons.push('Presence of agents/unknown party roles');
    }

    // Court cases
    const cases: CourtCaseDto[] = input.courtCases || [];
    const activeOrPending = cases.filter(c => ['active', 'pending'].includes((c.status || '').toLowerCase())).length;
    if (activeOrPending > 0) {
      score += Math.min(30, activeOrPending * 15);
      reasons.push(`${activeOrPending} active/pending court case(s)`);
    }
    const appealed = cases.filter(c => (c.status || '').toLowerCase() === 'appealed').length;
    if (appealed > 0) {
      score += Math.min(15, appealed * 10);
      reasons.push('Appealed case(s) associated with property');
    }

    // Encumbrances
    const encs: EncumbranceDto[] = input.encumbrances || [];
    if (encs.length > 0) {
      score += Math.min(25, encs.length * 8);
      reasons.push('Registered encumbrances present');
    }
    if (encs.some(e => /lien|caveat|foreclos/i.test(e.type))) {
      score += 10;
      reasons.push('Severe encumbrance detected (lien/caveat)');
    }

    // Property flags
    const prop = input.property || {} as any;
    if (prop.titleStatus && /disput|provisional/i.test(prop.titleStatus)) {
      score += 20;
      reasons.push(`Title status flagged: ${prop.titleStatus}`);
    }
    if (prop.surveyMismatch) {
      score += 12;
      reasons.push('Survey/measurement mismatch');
    }
    if (prop.overlappingClaims) {
      score += 20;
      reasons.push('Overlapping claims on parcel');
    }

    // History signals
    const historyDisputes = (input.history?.disputes || []).length;
    if (historyDisputes > 0) {
      score += Math.min(20, historyDisputes * 7);
      reasons.push('Previous disputes in property history');
    }

    // Normalize and clamp
    score = Math.max(1, Math.min(100, Math.round(score)));

    // Risk level mapping
    let level: RiskResponseDto['riskLevel'] = 'LOW';
    if (score >= 80) level = 'CRITICAL';
    else if (score >= 60) level = 'HIGH';
    else if (score >= 35) level = 'MEDIUM';

    // Ensure at least one reason
    if (reasons.length === 0) {
      reasons.push('No significant risk indicators found');
      score = 5;
      level = 'LOW';
    }

    return { riskScore: score, riskLevel: level, reasons };
  }
}
