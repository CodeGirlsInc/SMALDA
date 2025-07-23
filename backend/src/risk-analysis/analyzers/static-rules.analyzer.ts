import { Injectable } from "@nestjs/common"
import type { DocumentAnalyzer, AnalysisResult } from "../interfaces/document-analyzer.interface"
import { RiskLevel, type RiskFactor } from "../entities/risk-analysis.entity"

@Injectable()
export class StaticRulesAnalyzer implements DocumentAnalyzer {
  private readonly riskKeywords = {
    CRITICAL: {
      keywords: ["fraud", "forged", "illegal", "criminal", "stolen", "fake", "counterfeit"],
      score: 25,
      category: "Legal Issues",
    },
    HIGH: {
      keywords: [
        "dispute",
        "litigation",
        "lawsuit",
        "court",
        "pending",
        "contested",
        "encumbrance",
        "lien",
        "mortgage default",
      ],
      score: 20,
      category: "Legal Disputes",
    },
    MEDIUM: {
      keywords: ["incomplete", "missing", "unclear", "damaged", "partial", "expired", "outdated", "amendment needed"],
      score: 15,
      category: "Documentation Issues",
    },
    LOW: {
      keywords: ["minor discrepancy", "formatting issue", "typo", "clerical error"],
      score: 5,
      category: "Minor Issues",
    },
  }

  private readonly landOwnershipSpecificKeywords = {
    HIGH: {
      keywords: ["boundary dispute", "title defect", "easement conflict", "zoning violation", "tax delinquent"],
      score: 22,
      category: "Property Specific",
    },
    MEDIUM: {
      keywords: ["survey required", "permit needed", "inspection pending", "covenant restriction"],
      score: 12,
      category: "Compliance Issues",
    },
  }

  async analyzeDocument(content: string, documentName: string): Promise<AnalysisResult> {
    const contentLower = content.toLowerCase()
    const detectedKeywords: string[] = []
    const riskFactors: RiskFactor[] = []
    let totalScore = 0

    // Analyze general risk keywords
    for (const [severity, config] of Object.entries(this.riskKeywords)) {
      const foundKeywords = config.keywords.filter((keyword) => contentLower.includes(keyword.toLowerCase()))

      if (foundKeywords.length > 0) {
        detectedKeywords.push(...foundKeywords)
        const factorScore = config.score * foundKeywords.length
        totalScore += factorScore

        riskFactors.push({
          category: config.category,
          severity,
          description: `Detected ${foundKeywords.length} ${severity.toLowerCase()} risk keyword(s)`,
          keywords: foundKeywords,
          score: factorScore,
        })
      }
    }

    // Analyze land ownership specific keywords
    for (const [severity, config] of Object.entries(this.landOwnershipSpecificKeywords)) {
      const foundKeywords = config.keywords.filter((keyword) => contentLower.includes(keyword.toLowerCase()))

      if (foundKeywords.length > 0) {
        detectedKeywords.push(...foundKeywords)
        const factorScore = config.score * foundKeywords.length
        totalScore += factorScore

        riskFactors.push({
          category: config.category,
          severity,
          description: `Detected ${foundKeywords.length} property-specific ${severity.toLowerCase()} risk keyword(s)`,
          keywords: foundKeywords,
          score: factorScore,
        })
      }
    }

    // Additional document-specific analysis
    const additionalRisks = this.analyzeDocumentStructure(content, documentName)
    riskFactors.push(...additionalRisks.riskFactors)
    totalScore += additionalRisks.score
    detectedKeywords.push(...additionalRisks.keywords)

    // Determine risk level based on total score
    const riskLevel = this.calculateRiskLevel(totalScore)
    const summary = this.generateSummary(riskLevel, riskFactors, totalScore)

    return {
      riskLevel,
      summary,
      detectedKeywords: [...new Set(detectedKeywords)], // Remove duplicates
      riskFactors,
      riskScore: Math.round(totalScore * 100) / 100, // Round to 2 decimal places
    }
  }

  private analyzeDocumentStructure(
    content: string,
    documentName: string,
  ): {
    riskFactors: RiskFactor[]
    score: number
    keywords: string[]
  } {
    const riskFactors: RiskFactor[] = []
    let score = 0
    const keywords: string[] = []

    // Check document length (too short might be incomplete)
    if (content.length < 100) {
      riskFactors.push({
        category: "Document Quality",
        severity: "MEDIUM",
        description: "Document appears to be very short, potentially incomplete",
        keywords: ["short document"],
        score: 10,
      })
      score += 10
      keywords.push("short document")
    }

    // Check for common required sections in land ownership documents
    const requiredSections = ["legal description", "grantor", "grantee", "consideration", "signature"]
    const missingSections = requiredSections.filter((section) => !content.toLowerCase().includes(section))

    if (missingSections.length > 0) {
      const sectionScore = missingSections.length * 8
      riskFactors.push({
        category: "Document Completeness",
        severity: missingSections.length > 2 ? "HIGH" : "MEDIUM",
        description: `Missing required sections: ${missingSections.join(", ")}`,
        keywords: missingSections,
        score: sectionScore,
      })
      score += sectionScore
      keywords.push(...missingSections)
    }

    // Check file name for indicators
    const fileNameLower = documentName.toLowerCase()
    if (fileNameLower.includes("draft") || fileNameLower.includes("temp") || fileNameLower.includes("copy")) {
      riskFactors.push({
        category: "Document Status",
        severity: "MEDIUM",
        description: "File name suggests this may be a draft or temporary document",
        keywords: ["draft document"],
        score: 12,
      })
      score += 12
      keywords.push("draft document")
    }

    return { riskFactors, score, keywords }
  }

  private calculateRiskLevel(score: number): RiskLevel {
    if (score >= 50) return RiskLevel.CRITICAL
    if (score >= 30) return RiskLevel.HIGH
    if (score >= 15) return RiskLevel.MEDIUM
    return RiskLevel.LOW
  }

  private generateSummary(riskLevel: RiskLevel, riskFactors: RiskFactor[], score: number): string {
    const factorCount = riskFactors.length
    const categories = [...new Set(riskFactors.map((f) => f.category))]

    let summary = `Risk Level: ${riskLevel} (Score: ${score}). `

    if (factorCount === 0) {
      summary += "No significant risk factors detected in the document."
    } else {
      summary += `Detected ${factorCount} risk factor(s) across ${categories.length} categories: ${categories.join(", ")}. `

      const highRiskFactors = riskFactors.filter((f) => f.severity === "HIGH" || f.severity === "CRITICAL")
      if (highRiskFactors.length > 0) {
        summary += `Critical attention required for: ${highRiskFactors.map((f) => f.category).join(", ")}.`
      }
    }

    return summary
  }
}
