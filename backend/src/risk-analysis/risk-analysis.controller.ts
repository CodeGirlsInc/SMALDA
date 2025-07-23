import { Controller, Get, Post, Param, Delete, ParseUUIDPipe, UseInterceptors } from "@nestjs/common"
import type { RiskAnalysisService } from "./risk-analysis.service"
import type { AnalyzeDocumentDto } from "./dto/analyze-document.dto"
import type { RiskReportDto } from "./dto/risk-report.dto"
import { Audit } from "../audit-log/decorators/audit.decorator"
import { AuditAction, AuditSeverity } from "../audit-log/entities/audit-log.entity"
import { AuditInterceptor } from "../audit-log/interceptors/audit.interceptor"

@Controller("risk-analysis")
@UseInterceptors(AuditInterceptor)
export class RiskAnalysisController {
  constructor(private readonly riskAnalysisService: RiskAnalysisService) {}

  @Post("analyze")
  @Audit({
    action: AuditAction.ANALYZE_DOCUMENT,
    severity: AuditSeverity.MEDIUM,
    resourceType: "risk_analysis",
    description: "Document analyzed for risk factors",
  })
  async analyzeDocument(analyzeDocumentDto: AnalyzeDocumentDto): Promise<RiskReportDto> {
    const result = await this.riskAnalysisService.analyzeDocument(analyzeDocumentDto)

    // Additional audit log for high-risk documents
    if (result.riskLevel === "HIGH" || result.riskLevel === "CRITICAL") {
      // This would be handled by a separate audit call in a real implementation
      // For now, we'll let the interceptor handle it
    }

    return result
  }

  @Get()
  async findAll(riskLevel?: string): Promise<RiskReportDto[]> {
    if (riskLevel) {
      return await this.riskAnalysisService.findByRiskLevel(riskLevel)
    }
    return await this.riskAnalysisService.findAll()
  }

  @Get(":id")
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<RiskReportDto> {
    return await this.riskAnalysisService.findOne(id)
  }

  @Get("document/:documentId")
  async findByDocumentId(@Param("documentId", ParseUUIDPipe) documentId: string): Promise<RiskReportDto> {
    return await this.riskAnalysisService.findByDocumentId(documentId)
  }

  @Post("reanalyze/:documentId")
  @Audit({
    action: AuditAction.REANALYZE_DOCUMENT,
    severity: AuditSeverity.MEDIUM,
    resourceType: "risk_analysis",
    description: "Document reanalyzed for risk factors",
  })
  async reanalyzeDocument(
    @Param("documentId", ParseUUIDPipe) documentId: string,
    body: { analyzedBy: string; analysisMethod?: string },
  ): Promise<RiskReportDto> {
    return await this.riskAnalysisService.reanalyzeDocument(documentId, body.analyzedBy, body.analysisMethod)
  }

  @Delete(":id")
  @Audit({
    action: AuditAction.DELETE_RISK_ANALYSIS,
    severity: AuditSeverity.HIGH,
    resourceType: "risk_analysis",
    description: "Risk analysis deleted",
  })
  async deleteAnalysis(@Param("id", ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.riskAnalysisService.deleteAnalysis(id)
    return { message: "Risk analysis deleted successfully" }
  }

  @Post("flag-risk/:id")
  @Audit({
    action: AuditAction.FLAG_RISK,
    severity: AuditSeverity.HIGH,
    resourceType: "risk_analysis",
    description: "Risk manually flagged by user",
  })
  async flagRisk(@Param("id", ParseUUIDPipe) id: string): Promise<{ message: string }> {
    // This would implement manual risk flagging functionality
    // For now, just return a success message
    return { message: "Risk flagged successfully" }
  }

  @Post("approve-review/:id")
  @Audit({
    action: AuditAction.APPROVE_REVIEW,
    severity: AuditSeverity.MEDIUM,
    resourceType: "risk_analysis",
    description: "Risk analysis review approved",
  })
  async approveReview(@Param("id", ParseUUIDPipe) id: string): Promise<{ message: string }> {
    // This would implement review approval functionality
    // For now, just return a success message
    return { message: "Review approved successfully" }
  }

  @Post("reject-review/:id")
  @Audit({
    action: AuditAction.REJECT_REVIEW,
    severity: AuditSeverity.MEDIUM,
    resourceType: "risk_analysis",
    description: "Risk analysis review rejected",
  })
  async rejectReview(@Param("id", ParseUUIDPipe) id: string): Promise<{ message: string }> {
    // This would implement review rejection functionality
    // For now, just return a success message
    return { message: "Review rejected successfully" }
  }
}
