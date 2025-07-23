import { Injectable } from "@nestjs/common"
import type { DocumentAnalyzer, AnalysisResult } from "../interfaces/document-analyzer.interface"
import { RiskLevel, type RiskFactor } from "../entities/risk-analysis.entity"

@Injectable()
export class AiMockAnalyzer implements DocumentAnalyzer {
  async analyzeDocument(content: string, documentName: string): Promise<AnalysisResult> {
    // Simulate AI processing delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Mock AI analysis - in real implementation, this would call an AI service
    const mockAnalysis = this.generateMockAiAnalysis(content, documentName)

    return mockAnalysis
  }

  private generateMockAiAnalysis(content: string, documentName: string): AnalysisResult {
    // Simulate AI confidence scoring
    const contentLength = content.length
    const hasComplexTerms = /legal|property|ownership|deed|title/i.test(content)

    // Mock AI-detected patterns
    const aiDetectedPatterns = [
      {
        pattern: "inconsistent_dates",
        confidence: 0.85,
        description: "AI detected potential date inconsistencies",
      },
      {
        pattern: "unusual_language_patterns",
        confidence: 0.72,
        description: "AI identified unusual language patterns that may indicate issues",
      },
      {
        pattern: "missing_standard_clauses",
        confidence: 0.91,
        description: "AI detected missing standard legal clauses",
      },
    ]

    const riskFactors: RiskFactor[] = []
    const detectedKeywords: string[] = []
    let totalScore = 0

    // Simulate AI analysis results
    if (contentLength < 500) {
      riskFactors.push({
        category: "AI Document Analysis",
        severity: "MEDIUM",
        description: "AI analysis suggests document may be incomplete based on length and structure",
        keywords: ["ai_incomplete_analysis"],
        score: 15,
      })
      totalScore += 15
      detectedKeywords.push("ai_incomplete_analysis")
    }

    if (hasComplexTerms) {
      riskFactors.push({
        category: "AI Legal Complexity",
        severity: "LOW",
        description: "AI detected complex legal terminology requiring expert review",
        keywords: ["ai_complex_legal_terms"],
        score: 8,
      })
      totalScore += 8
      detectedKeywords.push("ai_complex_legal_terms")
    }

    // Add mock AI pattern analysis
    aiDetectedPatterns.forEach((pattern) => {
      if (pattern.confidence > 0.8) {
        const severity = pattern.confidence > 0.9 ? "HIGH" : "MEDIUM"
        const score = pattern.confidence > 0.9 ? 20 : 12

        riskFactors.push({
          category: "AI Pattern Analysis",
          severity,
          description: `${pattern.description} (Confidence: ${Math.round(pattern.confidence * 100)}%)`,
          keywords: [pattern.pattern],
          score,
        })
        totalScore += score
        detectedKeywords.push(pattern.pattern)
      }
    })

    const riskLevel = this.calculateRiskLevel(totalScore)
    const summary = this.generateAiSummary(riskLevel, riskFactors, totalScore)

    return {
      riskLevel,
      summary,
      detectedKeywords,
      riskFactors,
      riskScore: Math.round(totalScore * 100) / 100,
    }
  }

  private calculateRiskLevel(score: number): RiskLevel {
    if (score >= 40) return RiskLevel.CRITICAL
    if (score >= 25) return RiskLevel.HIGH
    if (score >= 12) return RiskLevel.MEDIUM
    return RiskLevel.LOW
  }

  private generateAiSummary(riskLevel: RiskLevel, riskFactors: RiskFactor[], score: number): string {
    return (
      `AI Analysis Complete - Risk Level: ${riskLevel} (AI Confidence Score: ${score}). ` +
      `AI identified ${riskFactors.length} potential risk patterns. ` +
      `Recommendation: ${riskLevel === RiskLevel.LOW ? "Document appears acceptable" : "Manual review recommended"}.`
    )
  }
}
