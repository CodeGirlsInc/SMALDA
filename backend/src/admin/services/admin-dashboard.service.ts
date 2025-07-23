import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { User } from "../entities/user.entity"
import type { Document } from "../../documents/entities/document.entity"
import type { RiskAnalysis } from "../../risk-analysis/entities/risk-analysis.entity"
import { RiskLevel } from "../../risk-analysis/entities/risk-analysis.entity"
import type { AuditLog } from "../../audit-log/entities/audit-log.entity"
import type { Notification } from "../../notification/entities/notification.entity"
import type { AdminDashboardStats, FlaggedDocument, SystemHealthMetrics } from "../interfaces/admin-stats.interface"
import type { RiskReportQueryDto, DocumentStatsQueryDto } from "../dto/admin-query.dto"

@Injectable()
export class AdminDashboardService {
  constructor(
    private userRepository: Repository<User>,
    private documentRepository: Repository<Document>,
    private riskAnalysisRepository: Repository<RiskAnalysis>,
    private auditLogRepository: Repository<AuditLog>,
    private notificationRepository: Repository<Notification>,
  ) {}

  async getDashboardStats(): Promise<AdminDashboardStats> {
    const [users, documents, riskAnalyses, auditLogs, notifications] = await Promise.all([
      this.userRepository.find(),
      this.documentRepository.find(),
      this.riskAnalysisRepository.find({ relations: ["document"] }),
      this.auditLogRepository.find({ order: { createdAt: "DESC" }, take: 1000 }),
      this.notificationRepository.find({ take: 1000 }),
    ])

    // Calculate date ranges
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // User stats
    const userStats = {
      total: users.length,
      active: users.filter((u) => u.status === "ACTIVE").length,
      inactive: users.filter((u) => u.status === "INACTIVE").length,
      byRole: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      recentRegistrations: users.filter((u) => u.createdAt >= thisWeek).length,
    }

    users.forEach((user) => {
      userStats.byRole[user.role] = (userStats.byRole[user.role] || 0) + 1
      userStats.byStatus[user.status] = (userStats.byStatus[user.status] || 0) + 1
    })

    // Document stats
    const documentStats = {
      total: documents.length,
      totalSize: documents.reduce((sum, doc) => sum + doc.size, 0),
      byMimeType: {} as Record<string, number>,
      uploadedToday: documents.filter((d) => d.createdAt >= today).length,
      uploadedThisWeek: documents.filter((d) => d.createdAt >= thisWeek).length,
      uploadedThisMonth: documents.filter((d) => d.createdAt >= thisMonth).length,
    }

    documents.forEach((doc) => {
      documentStats.byMimeType[doc.mimeType] = (documentStats.byMimeType[doc.mimeType] || 0) + 1
    })

    // Risk analysis stats
    const riskStats = {
      total: riskAnalyses.length,
      byRiskLevel: {} as Record<string, number>,
      flaggedDocuments: riskAnalyses.filter((r) => r.riskLevel === RiskLevel.HIGH || r.riskLevel === RiskLevel.CRITICAL)
        .length,
      pendingReview: riskAnalyses.filter((r) => r.riskLevel === RiskLevel.HIGH || r.riskLevel === RiskLevel.CRITICAL)
        .length,
      averageRiskScore:
        riskAnalyses.length > 0
          ? riskAnalyses.reduce((sum, r) => sum + Number(r.riskScore), 0) / riskAnalyses.length
          : 0,
      highRiskDocuments: riskAnalyses.filter((r) => r.riskLevel === RiskLevel.HIGH).length,
      criticalRiskDocuments: riskAnalyses.filter((r) => r.riskLevel === RiskLevel.CRITICAL).length,
    }

    riskAnalyses.forEach((risk) => {
      riskStats.byRiskLevel[risk.riskLevel] = (riskStats.byRiskLevel[risk.riskLevel] || 0) + 1
    })

    // Audit log stats
    const auditStats = {
      totalLogs: auditLogs.length,
      failedOperations: auditLogs.filter((log) => !log.success).length,
      suspiciousActivity: auditLogs.filter((log) => log.severity === "HIGH" || log.severity === "CRITICAL").length,
      todayActivity: auditLogs.filter((log) => log.createdAt >= today).length,
      topActions: this.getTopItems(auditLogs.map((log) => log.action)),
      topUsers: this.getTopUsers(auditLogs),
    }

    // Notification stats
    const notificationStats = {
      totalSent: notifications.filter((n) => n.status === "SENT" || n.status === "DELIVERED").length,
      totalFailed: notifications.filter((n) => n.status === "FAILED").length,
      unreadCount: notifications.filter((n) => n.status === "SENT" || n.status === "DELIVERED").length,
      byType: {} as Record<string, number>,
      byEvent: {} as Record<string, number>,
    }

    notifications.forEach((notification) => {
      notificationStats.byType[notification.type] = (notificationStats.byType[notification.type] || 0) + 1
      notificationStats.byEvent[notification.event] = (notificationStats.byEvent[notification.event] || 0) + 1
    })

    return {
      users: userStats,
      documents: documentStats,
      riskAnalysis: riskStats,
      auditLogs: auditStats,
      notifications: notificationStats,
    }
  }

  async getFlaggedDocuments(query?: RiskReportQueryDto): Promise<{
    documents: FlaggedDocument[]
    total: number
    limit: number
    offset: number
  }> {
    const { riskLevel, startDate, endDate, limit = 50, offset = 0 } = query || {}

    let queryBuilder = this.riskAnalysisRepository
      .createQueryBuilder("risk")
      .leftJoinAndSelect("risk.document", "document")
      .where("risk.riskLevel IN (:...levels)", {
        levels: riskLevel ? [riskLevel] : [RiskLevel.HIGH, RiskLevel.CRITICAL],
      })

    if (startDate && endDate) {
      queryBuilder = queryBuilder.andWhere("risk.createdAt BETWEEN :startDate AND :endDate", {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      })
    }

    queryBuilder = queryBuilder.orderBy("risk.createdAt", "DESC").take(limit).skip(offset)

    const [riskAnalyses, total] = await queryBuilder.getManyAndCount()

    const flaggedDocuments: FlaggedDocument[] = riskAnalyses.map((risk) => ({
      documentId: risk.documentId,
      documentName: risk.document.originalName,
      uploadedBy: risk.document.uploadedBy,
      uploadedAt: risk.document.createdAt,
      riskLevel: risk.riskLevel,
      riskScore: Number(risk.riskScore),
      flaggedAt: risk.createdAt,
      flaggedBy: risk.analyzedBy,
      flagReason: risk.summary,
      status: "PENDING", // This would come from a separate flagging system
    }))

    return {
      documents: flaggedDocuments,
      total,
      limit,
      offset,
    }
  }

  async getDocumentStats(query?: DocumentStatsQueryDto): Promise<{
    totalDocuments: number
    totalSize: number
    averageSize: number
    byMimeType: Record<string, { count: number; size: number }>
    byUploader: Record<string, number>
    uploadTrends: Array<{ date: string; count: number; size: number }>
    riskDistribution: Record<string, number>
  }> {
    const { startDate, endDate, uploadedBy, mimeType } = query || {}

    let queryBuilder = this.documentRepository.createQueryBuilder("document")

    if (startDate && endDate) {
      queryBuilder = queryBuilder.where("document.createdAt BETWEEN :startDate AND :endDate", {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      })
    }

    if (uploadedBy) {
      queryBuilder = queryBuilder.andWhere("document.uploadedBy = :uploadedBy", { uploadedBy })
    }

    if (mimeType) {
      queryBuilder = queryBuilder.andWhere("document.mimeType = :mimeType", { mimeType })
    }

    const documents = await queryBuilder.getMany()

    // Get risk analyses for these documents
    const riskAnalyses = await this.riskAnalysisRepository.find({
      where: { documentId: documents.map((d) => d.id) as any },
    })

    const stats = {
      totalDocuments: documents.length,
      totalSize: documents.reduce((sum, doc) => sum + doc.size, 0),
      averageSize: documents.length > 0 ? documents.reduce((sum, doc) => sum + doc.size, 0) / documents.length : 0,
      byMimeType: {} as Record<string, { count: number; size: number }>,
      byUploader: {} as Record<string, number>,
      uploadTrends: [] as Array<{ date: string; count: number; size: number }>,
      riskDistribution: {} as Record<string, number>,
    }

    // Calculate by MIME type
    documents.forEach((doc) => {
      if (!stats.byMimeType[doc.mimeType]) {
        stats.byMimeType[doc.mimeType] = { count: 0, size: 0 }
      }
      stats.byMimeType[doc.mimeType].count++
      stats.byMimeType[doc.mimeType].size += doc.size
    })

    // Calculate by uploader
    documents.forEach((doc) => {
      stats.byUploader[doc.uploadedBy] = (stats.byUploader[doc.uploadedBy] || 0) + 1
    })

    // Calculate upload trends (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split("T")[0]

      const dayDocuments = documents.filter((doc) => doc.createdAt.toISOString().split("T")[0] === dateStr)

      stats.uploadTrends.push({
        date: dateStr,
        count: dayDocuments.length,
        size: dayDocuments.reduce((sum, doc) => sum + doc.size, 0),
      })
    }

    // Calculate risk distribution
    riskAnalyses.forEach((risk) => {
      stats.riskDistribution[risk.riskLevel] = (stats.riskDistribution[risk.riskLevel] || 0) + 1
    })

    return stats
  }

  async getSystemHealth(): Promise<SystemHealthMetrics> {
    // Database health
    const totalUsers = await this.userRepository.count()
    const totalDocuments = await this.documentRepository.count()

    // Storage health
    const documents = await this.documentRepository.find()
    const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0)

    // Mock storage info (in a real app, you'd check actual disk usage)
    const mockTotalSpace = 1000 * 1024 * 1024 * 1024 // 1TB
    const mockUsedSpace = totalSize
    const mockAvailableSpace = mockTotalSpace - mockUsedSpace

    // Queue health (mock data - in real app, you'd check Bull queue stats)
    const queueStats = {
      activeJobs: 5,
      waitingJobs: 12,
      failedJobs: 2,
      completedJobs: 1543,
    }

    // Notification health
    const pendingNotifications = await this.notificationRepository.count({
      where: { status: "PENDING" },
    })
    const failedNotifications = await this.notificationRepository.count({
      where: { status: "FAILED" },
    })

    return {
      database: {
        status: totalUsers > 0 && totalDocuments >= 0 ? "healthy" : "warning",
        connectionCount: 10, // Mock data
        queryPerformance: 45, // Mock average query time in ms
      },
      storage: {
        totalSpace: mockTotalSpace,
        usedSpace: mockUsedSpace,
        availableSpace: mockAvailableSpace,
        documentsCount: totalDocuments,
      },
      queue: queueStats,
      notifications: {
        emailServiceStatus: failedNotifications < 10 ? "healthy" : "degraded",
        pendingNotifications,
        failedNotifications,
      },
    }
  }

  async moderateDocument(
    documentId: string,
    action: "approve" | "reject" | "quarantine",
    moderatorId: string,
    comments?: string,
  ): Promise<void> {
    // This would implement document moderation logic
    // For now, we'll just log the action in audit logs

    // In a real implementation, you might:
    // 1. Update document status
    // 2. Send notifications
    // 3. Create audit log entry
    // 4. Update risk analysis if needed

    console.log(`Document ${documentId} ${action}d by ${moderatorId}. Comments: ${comments}`)
  }

  private getTopItems(items: string[]): Array<{ action: string; count: number }> {
    const counts = items.reduce(
      (acc, item) => {
        acc[item] = (acc[item] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    return Object.entries(counts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  private getTopUsers(auditLogs: AuditLog[]): Array<{ userId: string; userEmail: string; count: number }> {
    const userCounts = auditLogs.reduce(
      (acc, log) => {
        const key = `${log.userId}:${log.userEmail}`
        acc[key] = (acc[key] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    return Object.entries(userCounts)
      .map(([userKey, count]) => {
        const [userId, userEmail] = userKey.split(":")
        return { userId, userEmail, count }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }
}
