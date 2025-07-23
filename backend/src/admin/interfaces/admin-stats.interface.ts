import type { RiskLevel } from "../../risk-analysis/entities/risk-analysis.entity"
import type { UserRole, UserStatus } from "../entities/user.entity"

export interface AdminDashboardStats {
  users: {
    total: number
    active: number
    inactive: number
    byRole: Record<UserRole, number>
    byStatus: Record<UserStatus, number>
    recentRegistrations: number
  }
  documents: {
    total: number
    totalSize: number
    byMimeType: Record<string, number>
    uploadedToday: number
    uploadedThisWeek: number
    uploadedThisMonth: number
  }
  riskAnalysis: {
    total: number
    byRiskLevel: Record<RiskLevel, number>
    flaggedDocuments: number
    pendingReview: number
    averageRiskScore: number
    highRiskDocuments: number
    criticalRiskDocuments: number
  }
  auditLogs: {
    totalLogs: number
    failedOperations: number
    suspiciousActivity: number
    todayActivity: number
    topActions: Array<{ action: string; count: number }>
    topUsers: Array<{ userId: string; userEmail: string; count: number }>
  }
  notifications: {
    totalSent: number
    totalFailed: number
    unreadCount: number
    byType: Record<string, number>
    byEvent: Record<string, number>
  }
}

export interface UserActivitySummary {
  userId: string
  userEmail: string
  fullName: string
  documentsUploaded: number
  documentsAnalyzed: number
  lastActivity: Date
  riskDocuments: number
  auditLogCount: number
  status: UserStatus
  role: UserRole
}

export interface FlaggedDocument {
  documentId: string
  documentName: string
  uploadedBy: string
  uploadedAt: Date
  riskLevel: RiskLevel
  riskScore: number
  flaggedAt: Date
  flaggedBy: string
  flagReason: string
  status: "PENDING" | "REVIEWED" | "APPROVED" | "REJECTED"
  reviewedBy?: string
  reviewedAt?: Date
  reviewComments?: string
}

export interface SystemHealthMetrics {
  database: {
    status: "healthy" | "warning" | "critical"
    connectionCount: number
    queryPerformance: number
  }
  storage: {
    totalSpace: number
    usedSpace: number
    availableSpace: number
    documentsCount: number
  }
  queue: {
    activeJobs: number
    waitingJobs: number
    failedJobs: number
    completedJobs: number
  }
  notifications: {
    emailServiceStatus: "healthy" | "degraded" | "down"
    pendingNotifications: number
    failedNotifications: number
  }
}
