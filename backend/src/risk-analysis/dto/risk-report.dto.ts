import type { RiskLevel, RiskFactor } from "../entities/risk-analysis.entity"

export class RiskReportDto {
  id: string
  documentId: string
  riskLevel: RiskLevel
  summary: string
  detectedKeywords: string[]
  riskFactors: RiskFactor[]
  riskScore: number
  analyzedBy: string
  analysisMethod: string
  createdAt: Date
  updatedAt: Date
}
