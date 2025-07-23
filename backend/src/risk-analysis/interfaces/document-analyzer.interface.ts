import type { RiskLevel, RiskFactor } from "../entities/risk-analysis.entity"

export interface AnalysisResult {
  riskLevel: RiskLevel
  summary: string
  detectedKeywords: string[]
  riskFactors: RiskFactor[]
  riskScore: number
}

export interface DocumentAnalyzer {
  analyzeDocument(content: string, documentName: string): Promise<AnalysisResult>
}
