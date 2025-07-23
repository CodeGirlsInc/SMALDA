import type { RiskLevel } from "../../risk-analysis/entities/risk-analysis.entity"
import type { AuditAction } from "../../audit-log/entities/audit-log.entity"

export interface DocumentAnalysisReportData {
  documents: Array<{
    id: string
    name: string
    originalName: string
    uploadedBy: string
    uploadedAt: Date
    size: number
    mimeType: string
    riskAnalysis?: {
      id: string
      riskLevel: RiskLevel
      riskScore: number
      summary: string
      detectedKeywords: string[]
      analyzedBy: string
      analyzedAt: Date
    }
  }>
  summary: {
    totalDocuments: number
    byRiskLevel: Record<RiskLevel, number>
    byMimeType: Record<string, number>
    averageRiskScore: number
    totalSize: number
  }
}

export interface RiskSummaryReportData {
  riskAnalyses: Array<{
    id: string
    documentId: string
    documentName: string
    riskLevel: RiskLevel
    riskScore: number
    summary: string
    detectedKeywords: string[]
    riskFactors: Array<{
      category: string
      severity: string
      description: string
      score: number
    }>
    analyzedBy: string
    analyzedAt: Date
    uploadedBy: string
  }>
  summary: {
    totalAnalyses: number
    byRiskLevel: Record<RiskLevel, number>
    averageRiskScore: number
    topRiskFactors: Array<{ category: string; count: number }>
    criticalDocuments: number
  }
}

export interface AuditTrailReportData {
  auditLogs: Array<{
    id: string
    userId: string
    userEmail: string
    action: AuditAction
    description: string
    resourceType: string
    resourceId: string
    success: boolean
    ipAddress: string
    createdAt: Date
  }>
  summary: {
    totalLogs: number
    byAction: Record<AuditAction, number>
    byUser: Record<string, number>
    failedOperations: number
    successRate: number
  }
}

export interface UserActivityReportData {
  users: Array<{
    id: string
    email: string
    fullName: string
    role: string
    department: string
    documentsUploaded: number
    documentsAnalyzed: number
    lastActivity: Date
    totalActions: number
    riskDocuments: number
  }>
  summary: {
    totalUsers: number
    activeUsers: number
    totalDocuments: number
    totalAnalyses: number
    byDepartment: Record<string, number>
  }
}

export interface SystemOverviewReportData {
  overview: {
    totalDocuments: number
    totalUsers: number
    totalRiskAnalyses: number
    totalAuditLogs: number
    totalNotifications: number
    systemUptime: string
    lastBackup: Date
  }
  metrics: {
    documentsPerDay: Array<{ date: string; count: number }>
    riskTrends: Array<{ date: string; riskLevel: RiskLevel; count: number }>
    userActivity: Array<{ date: string; activeUsers: number }>
    systemHealth: {
      database: string
      storage: string
      notifications: string
    }
  }
}

export interface ComplianceReportData {
  compliance: {
    totalDocuments: number
    compliantDocuments: number
    nonCompliantDocuments: number
    pendingReview: number
    complianceRate: number
  }
  violations: Array<{
    documentId: string
    documentName: string
    violationType: string
    severity: string
    description: string
    detectedAt: Date
    status: string
  }>
  recommendations: Array<{
    category: string
    priority: string
    description: string
    actionRequired: string
  }>
}
