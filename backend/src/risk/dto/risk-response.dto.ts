export interface RiskResponseDto {
  riskScore: number; // 1-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasons: string[];
}
