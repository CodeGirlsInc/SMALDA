import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { RiskAnalysis } from "./entities/risk-analysis.entity"
import { RiskLevel } from "./entities/risk-analysis.entity"
import type { AnalyzeDocumentDto } from "./dto/analyze-document.dto"
import type { RiskReportDto } from "./dto/risk-report.dto"
import type { DocumentsService } from "../documents/documents.service"
import type { StaticRulesAnalyzer } from "./analyzers/static-rules.analyzer"
import type { AiMockAnalyzer } from "./analyzers/ai-mock.analyzer"
import type { DocumentAnalyzer } from "./interfaces/document-analyzer.interface"
import type { NotificationService } from "../notification/notification.service"
import { NotificationEvent } from "../notification/entities/notification.entity"
import * as fs from "fs"
import * as pdf from "pdf-parse"

@Injectable()
export class RiskAnalysisService {
  private readonly analyzers: Map<string, DocumentAnalyzer> = new Map()

  constructor(
    private riskAnalysisRepository: Repository<RiskAnalysis>,
    private documentsService: DocumentsService,
    private staticRulesAnalyzer: StaticRulesAnalyzer,
    private aiMockAnalyzer: AiMockAnalyzer,
    private notificationService: NotificationService,
  ) {
    // Register available analyzers
    this.analyzers.set("STATIC_RULES", this.staticRulesAnalyzer)
    this.analyzers.set("AI_ANALYSIS", this.aiMockAnalyzer)
  }

  async analyzeDocument(analyzeDocumentDto: AnalyzeDocumentDto): Promise<RiskReportDto> {
    const { documentId, analyzedBy, analysisMethod = "STATIC_RULES" } = analyzeDocumentDto

    // Get document from documents service
    const document = await this.documentsService.findOne(documentId)

    // Check if analysis already exists
    const existingAnalysis = await this.riskAnalysisRepository.findOne({
      where: { documentId },
    })

    if (existingAnalysis) {
      throw new BadRequestException("Document has already been analyzed")
    }

    // Extract text content from document
    const textContent = await this.extractTextFromDocument(document.filePath, document.mimeType)

    // Get appropriate analyzer
    const analyzer = this.analyzers.get(analysisMethod)
    if (!analyzer) {
      throw new BadRequestException(`Analysis method ${analysisMethod} not supported`)
    }

    // Perform analysis
    const analysisResult = await analyzer.analyzeDocument(textContent, document.originalName)

    // Save analysis results
    const riskAnalysis = this.riskAnalysisRepository.create({
      documentId,
      riskLevel: analysisResult.riskLevel,
      summary: analysisResult.summary,
      detectedKeywords: analysisResult.detectedKeywords,
      riskFactors: analysisResult.riskFactors,
      riskScore: analysisResult.riskScore,
      analyzedBy,
      analysisMethod,
    })

    const savedAnalysis = await this.riskAnalysisRepository.save(riskAnalysis)

    // Send notifications based on risk level
    await this.sendRiskNotifications(savedAnalysis, document)

    return this.mapToRiskReportDto(savedAnalysis)
  }

  private async sendRiskNotifications(analysis: RiskAnalysis, document: any): Promise<void> {
    let notificationEvent: NotificationEvent

    // Determine notification event based on risk level
    switch (analysis.riskLevel) {
      case RiskLevel.CRITICAL:
        notificationEvent = NotificationEvent.CRITICAL_RISK_DETECTED
        break
      case RiskLevel.HIGH:
        notificationEvent = NotificationEvent.HIGH_RISK_DETECTED
        break
      case RiskLevel.MEDIUM:
      case RiskLevel.LOW:
        notificationEvent = NotificationEvent.RISK_DETECTED
        break
      default:
        return // No notification for very low risks
    }

    // Prepare notification data
    const notificationData = {
      recipientId: document.uploadedBy,
      recipientEmail: `${document.uploadedBy}@example.com`, // In real app, get from user service
      event: notificationEvent,
      data: {
        recipientName: document.uploadedBy,
        documentName: document.originalName,
        documentId: document.id,
        riskLevel: analysis.riskLevel,
        riskScore: analysis.riskScore,
        riskSummary: analysis.summary,
        detectedKeywords: analysis.detectedKeywords.join(", "),
        documentUrl: `${process.env.APP_URL || "http://localhost:3000"}/documents/${document.id}`,
        detectedAt: new Date().toISOString(),
      },
      resourceType: "risk_analysis",
      resourceId: analysis.id,
      senderId: "system",
      senderEmail: "system@landregistry.com",
    }

    // Send notification
    await this.notificationService.sendNotification(notificationData)
  }

  async findAll(): Promise<RiskReportDto[]> {
    const analyses = await this.riskAnalysisRepository.find({
      order: { createdAt: "DESC" },
    })

    return analyses.map((analysis) => this.mapToRiskReportDto(analysis))
  }

  async findOne(id: string): Promise<RiskReportDto> {
    const analysis = await this.riskAnalysisRepository.findOne({
      where: { id },
      relations: ["document"],
    })

    if (!analysis) {
      throw new NotFoundException(`Risk analysis with ID ${id} not found`)
    }

    return this.mapToRiskReportDto(analysis)
  }

  async findByDocumentId(documentId: string): Promise<RiskReportDto> {
    const analysis = await this.riskAnalysisRepository.findOne({
      where: { documentId },
      relations: ["document"],
    })

    if (!analysis) {
      throw new NotFoundException(`Risk analysis for document ${documentId} not found`)
    }

    return this.mapToRiskReportDto(analysis)
  }

  async findByRiskLevel(riskLevel: string): Promise<RiskReportDto[]> {
    const analyses = await this.riskAnalysisRepository.find({
      where: { riskLevel: riskLevel as any },
      order: { createdAt: "DESC" },
    })

    return analyses.map((analysis) => this.mapToRiskReportDto(analysis))
  }

  async deleteAnalysis(id: string): Promise<void> {
    const analysis = await this.findOne(id)
    await this.riskAnalysisRepository.remove(analysis as any)
  }

  async reanalyzeDocument(
    documentId: string,
    analyzedBy: string,
    analysisMethod = "STATIC_RULES",
  ): Promise<RiskReportDto> {
    // Delete existing analysis if it exists
    const existingAnalysis = await this.riskAnalysisRepository.findOne({
      where: { documentId },
    })

    if (existingAnalysis) {
      await this.riskAnalysisRepository.remove(existingAnalysis)
    }

    // Perform new analysis
    return await this.analyzeDocument({
      documentId,
      analyzedBy,
      analysisMethod: analysisMethod as any,
    })
  }

  async approveReview(analysisId: string, reviewerId: string, comments?: string): Promise<void> {
    const analysis = await this.riskAnalysisRepository.findOne({
      where: { id: analysisId },
      relations: ["document"],
    })

    if (!analysis) {
      throw new NotFoundException(`Risk analysis with ID ${analysisId} not found`)
    }

    // Send approval notification
    const notificationData = {
      recipientId: analysis.document.uploadedBy,
      recipientEmail: `${analysis.document.uploadedBy}@example.com`,
      event: NotificationEvent.REVIEW_APPROVED,
      data: {
        recipientName: analysis.document.uploadedBy,
        documentName: analysis.document.originalName,
        documentId: analysis.document.id,
        reviewerName: reviewerId,
        approvedAt: new Date().toISOString(),
        reviewComments: comments || "No comments provided",
        documentUrl: `${process.env.APP_URL || "http://localhost:3000"}/documents/${analysis.document.id}`,
      },
      resourceType: "risk_analysis",
      resourceId: analysisId,
      senderId: reviewerId,
      senderEmail: `${reviewerId}@example.com`,
    }

    await this.notificationService.sendNotification(notificationData)
  }

  async rejectReview(analysisId: string, reviewerId: string, reason: string, comments?: string): Promise<void> {
    const analysis = await this.riskAnalysisRepository.findOne({
      where: { id: analysisId },
      relations: ["document"],
    })

    if (!analysis) {
      throw new NotFoundException(`Risk analysis with ID ${analysisId} not found`)
    }

    // Send rejection notification
    const notificationData = {
      recipientId: analysis.document.uploadedBy,
      recipientEmail: `${analysis.document.uploadedBy}@example.com`,
      event: NotificationEvent.REVIEW_REJECTED,
      data: {
        recipientName: analysis.document.uploadedBy,
        documentName: analysis.document.originalName,
        documentId: analysis.document.id,
        reviewerName: reviewerId,
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason,
        reviewComments: comments || "No additional comments",
        documentUrl: `${process.env.APP_URL || "http://localhost:3000"}/documents/${analysis.document.id}`,
      },
      resourceType: "risk_analysis",
      resourceId: analysisId,
      senderId: reviewerId,
      senderEmail: `${reviewerId}@example.com`,
    }

    await this.notificationService.sendNotification(notificationData)
  }

  private async extractTextFromDocument(filePath: string, mimeType: string): Promise<string> {
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException("Document file not found")
    }

    try {
      switch (mimeType) {
        case "application/pdf":
          const pdfBuffer = fs.readFileSync(filePath)
          const pdfData = await pdf(pdfBuffer)
          return pdfData.text

        case "text/plain":
          return fs.readFileSync(filePath, "utf-8")

        case "application/msword":
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          // For Word documents, you would need additional libraries like mammoth
          // For now, return a placeholder
          return "Word document content extraction not implemented yet"

        default:
          throw new BadRequestException(`Text extraction not supported for MIME type: ${mimeType}`)
      }
    } catch (error) {
      throw new BadRequestException(`Failed to extract text from document: ${error.message}`)
    }
  }

  private mapToRiskReportDto(analysis: RiskAnalysis): RiskReportDto {
    return {
      id: analysis.id,
      documentId: analysis.documentId,
      riskLevel: analysis.riskLevel,
      summary: analysis.summary,
      detectedKeywords: analysis.detectedKeywords,
      riskFactors: analysis.riskFactors,
      riskScore: analysis.riskScore,
      analyzedBy: analysis.analyzedBy,
      analysisMethod: analysis.analysisMethod,
      createdAt: analysis.createdAt,
      updatedAt: analysis.updatedAt,
    }
  }
}
