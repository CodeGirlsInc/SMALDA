import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import { In } from "typeorm"
import type { Document } from "../../documents/entities/document.entity"
import type { RiskAnalysis } from "../../risk-analysis/entities/risk-analysis.entity"
import { RiskLevel } from "../../risk-analysis/entities/risk-analysis.entity"
import type { AuditLog } from "../../audit-log/entities/audit-log.entity"
import type { User } from "../../admin/entities/user.entity"
import type { Notification } from "../../notification/entities/notification.entity"
import type {
  DocumentAnalysisReportData,
  RiskSummaryReportData,
  AuditTrailReportData,
  UserActivityReportData,
  SystemOverviewReportData,
  ComplianceReportData,
} from "../interfaces/report-data.interface"

@Injectable()
export class DataAggregatorService {
  private readonly logger = new Logger(DataAggregatorService.name)

  constructor(
    private documentRepository: Repository<Document>,
    private riskAnalysisRepository: Repository<RiskAnalysis>,
    private auditLogRepository: Repository<AuditLog>,
    private userRepository: Repository<User>,
    private notificationRepository: Repository<Notification>,
  ) {}

  async aggregateDocumentAnalysisData(filters: {
    startDate?: Date
    endDate?: Date
    documentIds?: string[]
    userIds?: string[]
    riskLevel?: string
  }): Promise<DocumentAnalysisReportData> {
    let documentQuery = this.documentRepository.createQueryBuilder("document")

    if (filters.startDate && filters.endDate) {
      documentQuery = documentQuery.where("document.createdAt BETWEEN :startDate AND :endDate", {
        startDate: filters.startDate,
        endDate: filters.endDate,
      })
    }

    if (filters.documentIds && filters.documentIds.length > 0) {
      documentQuery = documentQuery.andWhere("document.id IN (:...documentIds)", {
        documentIds: filters.documentIds,
      })
    }

    if (filters.userIds && filters.userIds.length > 0) {
      documentQuery = documentQuery.andWhere("document.uploadedBy IN (:...userIds)", {
        userIds: filters.userIds,
      })
    }

    const documents = await documentQuery.getMany()

    // Get risk analyses for these documents
    const riskAnalyses = await this.riskAnalysisRepository.find({
      where: { documentId: In(documents.map((d) => d.id)) },
    })

    const riskAnalysisMap = new Map(riskAnalyses.map((ra) => [ra.documentId, ra]))

    // Filter by risk level if specified
    let filteredDocuments = documents
    if (filters.riskLevel) {
      filteredDocuments = documents.filter((doc) => {
        const analysis = riskAnalysisMap.get(doc.id)
        return analysis && analysis.riskLevel === filters.riskLevel
      })
    }

    // Build document data with risk analysis
    const documentData = filteredDocuments.map((doc) => ({
      id: doc.id,
      name: doc.name,
      originalName: doc.originalName,
      uploadedBy: doc.uploadedBy,
      uploadedAt: doc.createdAt,
      size: doc.size,
      mimeType: doc.mimeType,
      riskAnalysis: riskAnalysisMap.get(doc.id)
        ? {
            id: riskAnalysisMap.get(doc.id)!.id,
            riskLevel: riskAnalysisMap.get(doc.id)!.riskLevel,
            riskScore: Number(riskAnalysisMap.get(doc.id)!.riskScore),
            summary: riskAnalysisMap.get(doc.id)!.summary,
            detectedKeywords: riskAnalysisMap.get(doc.id)!.detectedKeywords,
            analyzedBy: riskAnalysisMap.get(doc.id)!.analyzedBy,
            analyzedAt: riskAnalysisMap.get(doc.id)!.createdAt,
          }
        : undefined,
    }))

    // Calculate summary statistics
    const byRiskLevel = {} as Record<RiskLevel, number>
    const byMimeType = {} as Record<string, number>
    let totalRiskScore = 0
    let analyzedCount = 0

    documentData.forEach((doc) => {
      // Count by MIME type
      byMimeType[doc.mimeType] = (byMimeType[doc.mimeType] || 0) + 1

      // Count by risk level and calculate average score
      if (doc.riskAnalysis) {
        byRiskLevel[doc.riskAnalysis.riskLevel] = (byRiskLevel[doc.riskAnalysis.riskLevel] || 0) + 1
        totalRiskScore += doc.riskAnalysis.riskScore
        analyzedCount++
      }
    })

    return {
      documents: documentData,
      summary: {
        totalDocuments: documentData.length,
        byRiskLevel,
        byMimeType,
        averageRiskScore: analyzedCount > 0 ? totalRiskScore / analyzedCount : 0,
        totalSize: documentData.reduce((sum, doc) => sum + doc.size, 0),
      },
    }
  }

  async aggregateRiskSummaryData(filters: {
    startDate?: Date
    endDate?: Date
    riskLevel?: string
    userIds?: string[]
  }): Promise<RiskSummaryReportData> {
    let query = this.riskAnalysisRepository.createQueryBuilder("risk").leftJoinAndSelect("risk.document", "document")

    if (filters.startDate && filters.endDate) {
      query = query.where("risk.createdAt BETWEEN :startDate AND :endDate", {
        startDate: filters.startDate,
        endDate: filters.endDate,
      })
    }

    if (filters.riskLevel) {
      query = query.andWhere("risk.riskLevel = :riskLevel", { riskLevel: filters.riskLevel })
    }

    if (filters.userIds && filters.userIds.length > 0) {
      query = query.andWhere("document.uploadedBy IN (:...userIds)", { userIds: filters.userIds })
    }

    const riskAnalyses = await query.getMany()

    const riskData = riskAnalyses.map((analysis) => ({
      id: analysis.id,
      documentId: analysis.documentId,
      documentName: analysis.document.originalName,
      riskLevel: analysis.riskLevel,
      riskScore: Number(analysis.riskScore),
      summary: analysis.summary,
      detectedKeywords: analysis.detectedKeywords,
      riskFactors: analysis.riskFactors,
      analyzedBy: analysis.analyzedBy,
      analyzedAt: analysis.createdAt,
      uploadedBy: analysis.document.uploadedBy,
    }))

    // Calculate summary statistics
    const byRiskLevel = {} as Record<RiskLevel, number>
    const riskFactorCounts = {} as Record<string, number>
    let totalRiskScore = 0

    riskData.forEach((analysis) => {
      byRiskLevel[analysis.riskLevel] = (byRiskLevel[analysis.riskLevel] || 0) + 1
      totalRiskScore += analysis.riskScore

      analysis.riskFactors.forEach((factor) => {
        riskFactorCounts[factor.category] = (riskFactorCounts[factor.category] || 0) + 1
      })
    })

    const topRiskFactors = Object.entries(riskFactorCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      riskAnalyses: riskData,
      summary: {
        totalAnalyses: riskData.length,
        byRiskLevel,
        averageRiskScore: riskData.length > 0 ? totalRiskScore / riskData.length : 0,
        topRiskFactors,
        criticalDocuments: byRiskLevel[RiskLevel.CRITICAL] || 0,
      },
    }
  }

  async aggregateAuditTrailData(filters: {
    startDate?: Date
    endDate?: Date
    userIds?: string[]
    actions?: string[]
  }): Promise<AuditTrailReportData> {
    let query = this.auditLogRepository.createQueryBuilder("audit")

    if (filters.startDate && filters.endDate) {
      query = query.where("audit.createdAt BETWEEN :startDate AND :endDate", {
        startDate: filters.startDate,
        endDate: filters.endDate,
      })
    }

    if (filters.userIds && filters.userIds.length > 0) {
      query = query.andWhere("audit.userId IN (:...userIds)", { userIds: filters.userIds })
    }

    if (filters.actions && filters.actions.length > 0) {
      query = query.andWhere("audit.action IN (:...actions)", { actions: filters.actions })
    }

    query = query.orderBy("audit.createdAt", "DESC")

    const auditLogs = await query.getMany()

    const auditData = auditLogs.map((log) => ({
      id: log.id,
      userId: log.userId,
      userEmail: log.userEmail,
      action: log.action,
      description: log.description,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      success: log.success,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    }))

    // Calculate summary statistics
    const byAction = {} as Record<string, number>
    const byUser = {} as Record<string, number>
    let failedOperations = 0

    auditData.forEach((log) => {
      byAction[log.action] = (byAction[log.action] || 0) + 1
      byUser[log.userEmail] = (byUser[log.userEmail] || 0) + 1
      if (!log.success) {
        failedOperations++
      }
    })

    return {
      auditLogs: auditData,
      summary: {
        totalLogs: auditData.length,
        byAction: byAction as any,
        byUser,
        failedOperations,
        successRate: auditData.length > 0 ? ((auditData.length - failedOperations) / auditData.length) * 100 : 100,
      },
    }
  }

  async aggregateUserActivityData(filters: {
    startDate?: Date
    endDate?: Date
    userIds?: string[]
    department?: string
  }): Promise<UserActivityReportData> {
    let userQuery = this.userRepository.createQueryBuilder("user")

    if (filters.userIds && filters.userIds.length > 0) {
      userQuery = userQuery.where("user.id IN (:...userIds)", { userIds: filters.userIds })
    }

    if (filters.department) {
      userQuery = userQuery.andWhere("user.department = :department", { department: filters.department })
    }

    const users = await userQuery.getMany()

    // Get activity data for each user
    const userData = await Promise.all(
      users.map(async (user) => {
        // Count documents uploaded
        let docQuery = this.documentRepository.createQueryBuilder("doc").where("doc.uploadedBy = :userId", {
          userId: user.id,
        })

        if (filters.startDate && filters.endDate) {
          docQuery = docQuery.andWhere("doc.createdAt BETWEEN :startDate AND :endDate", {
            startDate: filters.startDate,
            endDate: filters.endDate,
          })
        }

        const documentsUploaded = await docQuery.getCount()

        // Count risk analyses performed
        let riskQuery = this.riskAnalysisRepository.createQueryBuilder("risk").where("risk.analyzedBy = :userId", {
          userId: user.id,
        })

        if (filters.startDate && filters.endDate) {
          riskQuery = riskQuery.andWhere("risk.createdAt BETWEEN :startDate AND :endDate", {
            startDate: filters.startDate,
            endDate: filters.endDate,
          })
        }

        const documentsAnalyzed = await riskQuery.getCount()

        // Count high-risk documents
        const riskDocuments = await this.riskAnalysisRepository
          .createQueryBuilder("risk")
          .leftJoin("risk.document", "doc")
          .where("doc.uploadedBy = :userId", { userId: user.id })
          .andWhere("risk.riskLevel IN (:...levels)", { levels: [RiskLevel.HIGH, RiskLevel.CRITICAL] })
          .getCount()

        // Count total audit actions
        let auditQuery = this.auditLogRepository.createQueryBuilder("audit").where("audit.userId = :userId", {
          userId: user.id,
        })

        if (filters.startDate && filters.endDate) {
          auditQuery = auditQuery.andWhere("audit.createdAt BETWEEN :startDate AND :endDate", {
            startDate: filters.startDate,
            endDate: filters.endDate,
          })
        }

        const totalActions = await auditQuery.getCount()

        return {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          department: user.department || "N/A",
          documentsUploaded,
          documentsAnalyzed,
          lastActivity: user.lastLoginAt || user.updatedAt,
          totalActions,
          riskDocuments,
        }
      }),
    )

    // Calculate summary statistics
    const byDepartment = {} as Record<string, number>
    let activeUsers = 0
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    userData.forEach((user) => {
      byDepartment[user.department] = (byDepartment[user.department] || 0) + 1
      if (user.lastActivity >= thirtyDaysAgo) {
        activeUsers++
      }
    })

    return {
      users: userData,
      summary: {
        totalUsers: userData.length,
        activeUsers,
        totalDocuments: userData.reduce((sum, user) => sum + user.documentsUploaded, 0),
        totalAnalyses: userData.reduce((sum, user) => sum + user.documentsAnalyzed, 0),
        byDepartment,
      },
    }
  }

  async aggregateSystemOverviewData(): Promise<SystemOverviewReportData> {
    const [totalDocuments, totalUsers, totalRiskAnalyses, totalAuditLogs, totalNotifications] = await Promise.all([
      this.documentRepository.count(),
      this.userRepository.count(),
      this.riskAnalysisRepository.count(),
      this.auditLogRepository.count(),
      this.notificationRepository.count(),
    ])

    // Get activity trends for last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const documentsPerDay = await this.getDocumentsPerDay(thirtyDaysAgo, new Date())
    const userActivity = await this.getUserActivityPerDay(thirtyDaysAgo, new Date())
    const riskTrends = await this.getRiskTrendsPerDay(thirtyDaysAgo, new Date())

    return {
      overview: {
        totalDocuments,
        totalUsers,
        totalRiskAnalyses,
        totalAuditLogs,
        totalNotifications,
        systemUptime: this.calculateUptime(),
        lastBackup: new Date(), // Mock data - in real app, get from backup service
      },
      metrics: {
        documentsPerDay,
        riskTrends,
        userActivity,
        systemHealth: {
          database: "healthy",
          storage: "healthy",
          notifications: "healthy",
        },
      },
    }
  }

  async aggregateComplianceData(filters: {
    startDate?: Date
    endDate?: Date
    documentIds?: string[]
  }): Promise<ComplianceReportData> {
    // Get all risk analyses for compliance assessment
    let query = this.riskAnalysisRepository.createQueryBuilder("risk").leftJoinAndSelect("risk.document", "document")

    if (filters.startDate && filters.endDate) {
      query = query.where("risk.createdAt BETWEEN :startDate AND :endDate", {
        startDate: filters.startDate,
        endDate: filters.endDate,
      })
    }

    if (filters.documentIds && filters.documentIds.length > 0) {
      query = query.andWhere("risk.documentId IN (:...documentIds)", { documentIds: filters.documentIds })
    }

    const riskAnalyses = await query.getMany()

    // Determine compliance status based on risk levels
    const compliantDocuments = riskAnalyses.filter((r) => r.riskLevel === RiskLevel.LOW).length
    const nonCompliantDocuments = riskAnalyses.filter(
      (r) => r.riskLevel === RiskLevel.HIGH || r.riskLevel === RiskLevel.CRITICAL,
    ).length
    const pendingReview = riskAnalyses.filter((r) => r.riskLevel === RiskLevel.MEDIUM).length

    // Generate violations for non-compliant documents
    const violations = riskAnalyses
      .filter((r) => r.riskLevel === RiskLevel.HIGH || r.riskLevel === RiskLevel.CRITICAL)
      .map((analysis) => ({
        documentId: analysis.documentId,
        documentName: analysis.document.originalName,
        violationType: this.determineViolationType(analysis.detectedKeywords),
        severity: analysis.riskLevel,
        description: analysis.summary,
        detectedAt: analysis.createdAt,
        status: "OPEN",
      }))

    // Generate recommendations
    const recommendations = this.generateComplianceRecommendations(riskAnalyses)

    return {
      compliance: {
        totalDocuments: riskAnalyses.length,
        compliantDocuments,
        nonCompliantDocuments,
        pendingReview,
        complianceRate: riskAnalyses.length > 0 ? (compliantDocuments / riskAnalyses.length) * 100 : 100,
      },
      violations,
      recommendations,
    }
  }

  private async getDocumentsPerDay(startDate: Date, endDate: Date): Promise<Array<{ date: string; count: number }>> {
    const query = `
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM documents
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY DATE(created_at)
      ORDER BY date
    `

    // Mock implementation - in real app, use raw query
    const result = []
    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const count = Math.floor(Math.random() * 20) // Mock data
      result.push({
        date: currentDate.toISOString().split("T")[0],
        count,
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return result
  }

  private async getUserActivityPerDay(
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ date: string; activeUsers: number }>> {
    // Mock implementation
    const result = []
    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const activeUsers = Math.floor(Math.random() * 50) + 10 // Mock data
      result.push({
        date: currentDate.toISOString().split("T")[0],
        activeUsers,
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return result
  }

  private async getRiskTrendsPerDay(
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ date: string; riskLevel: RiskLevel; count: number }>> {
    // Mock implementation
    const result = []
    const currentDate = new Date(startDate)
    const riskLevels = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL]

    while (currentDate <= endDate) {
      riskLevels.forEach((level) => {
        const count = Math.floor(Math.random() * 10) // Mock data
        result.push({
          date: currentDate.toISOString().split("T")[0],
          riskLevel: level,
          count,
        })
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return result
  }

  private calculateUptime(): string {
    // Mock uptime calculation
    const uptimeHours = Math.floor(Math.random() * 8760) + 8000 // Mock: 8000+ hours
    const days = Math.floor(uptimeHours / 24)
    const hours = uptimeHours % 24
    return `${days} days, ${hours} hours`
  }

  private determineViolationType(keywords: string[]): string {
    if (keywords.some((k) => ["fraud", "illegal", "criminal"].includes(k.toLowerCase()))) {
      return "Legal Violation"
    }
    if (keywords.some((k) => ["dispute", "litigation", "court"].includes(k.toLowerCase()))) {
      return "Legal Dispute"
    }
    if (keywords.some((k) => ["incomplete", "missing", "expired"].includes(k.toLowerCase()))) {
      return "Documentation Issue"
    }
    return "Compliance Issue"
  }

  private generateComplianceRecommendations(riskAnalyses: RiskAnalysis[]): Array<{
    category: string
    priority: string
    description: string
    actionRequired: string
  }> {
    const recommendations = []

    const criticalCount = riskAnalyses.filter((r) => r.riskLevel === RiskLevel.CRITICAL).length
    const highCount = riskAnalyses.filter((r) => r.riskLevel === RiskLevel.HIGH).length

    if (criticalCount > 0) {
      recommendations.push({
        category: "Critical Risk Management",
        priority: "URGENT",
        description: `${criticalCount} documents have critical risk levels requiring immediate attention`,
        actionRequired: "Review and remediate critical risk documents within 24 hours",
      })
    }

    if (highCount > 0) {
      recommendations.push({
        category: "High Risk Management",
        priority: "HIGH",
        description: `${highCount} documents have high risk levels`,
        actionRequired: "Schedule review and remediation within 72 hours",
      })
    }

    // Add more recommendations based on patterns
    const commonKeywords = this.getCommonRiskKeywords(riskAnalyses)
    if (commonKeywords.length > 0) {
      recommendations.push({
        category: "Process Improvement",
        priority: "MEDIUM",
        description: `Common risk patterns detected: ${commonKeywords.join(", ")}`,
        actionRequired: "Implement preventive measures and staff training",
      })
    }

    return recommendations
  }

  private getCommonRiskKeywords(riskAnalyses: RiskAnalysis[]): string[] {
    const keywordCounts = {} as Record<string, number>

    riskAnalyses.forEach((analysis) => {
      analysis.detectedKeywords.forEach((keyword) => {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1
      })
    })

    return Object.entries(keywordCounts)
      .filter(([, count]) => count >= 3) // Keywords appearing in 3+ documents
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([keyword]) => keyword)
  }
}
