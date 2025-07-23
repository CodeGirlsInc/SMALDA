import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import { Between, Like, In } from "typeorm"
import type { AuditLog } from "./entities/audit-log.entity"
import type { CreateAuditLogDto } from "./dto/create-audit-log.dto"
import type { AuditLogQueryDto } from "./dto/audit-log-query.dto"
import type { AuditContext, AuditLogData } from "./interfaces/audit-context.interface"

@Injectable()
export class AuditLogService {
  constructor(private auditLogRepository: Repository<AuditLog>) {}

  async createLog(createAuditLogDto: CreateAuditLogDto): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create(createAuditLogDto)
    return await this.auditLogRepository.save(auditLog)
  }

  async log(context: AuditContext, data: AuditLogData): Promise<AuditLog> {
    const createDto: CreateAuditLogDto = {
      userId: context.userId,
      userEmail: context.userEmail,
      action: data.action,
      severity: data.severity,
      description: data.description,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      metadata: data.metadata,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      success: data.success,
      errorMessage: data.errorMessage,
    }

    return await this.createLog(createDto)
  }

  async findAll(query: AuditLogQueryDto): Promise<{
    logs: AuditLog[]
    total: number
    limit: number
    offset: number
  }> {
    const {
      userId,
      action,
      severity,
      resourceType,
      resourceId,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
      search,
    } = query

    const whereConditions: any = {}

    if (userId) {
      whereConditions.userId = userId
    }

    if (action) {
      whereConditions.action = action
    }

    if (severity) {
      whereConditions.severity = severity
    }

    if (resourceType) {
      whereConditions.resourceType = resourceType
    }

    if (resourceId) {
      whereConditions.resourceId = resourceId
    }

    if (startDate && endDate) {
      whereConditions.createdAt = Between(new Date(startDate), new Date(endDate))
    } else if (startDate) {
      whereConditions.createdAt = Between(new Date(startDate), new Date())
    }

    if (search) {
      whereConditions.description = Like(`%${search}%`)
    }

    const [logs, total] = await this.auditLogRepository.findAndCount({
      where: whereConditions,
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    })

    return {
      logs,
      total,
      limit,
      offset,
    }
  }

  async findOne(id: string): Promise<AuditLog | null> {
    return await this.auditLogRepository.findOne({
      where: { id },
    })
  }

  async findByUser(userId: string, limit = 50, offset = 0): Promise<AuditLog[]> {
    return await this.auditLogRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    })
  }

  async findByResource(resourceType: string, resourceId: string): Promise<AuditLog[]> {
    return await this.auditLogRepository.find({
      where: { resourceType, resourceId },
      order: { createdAt: "DESC" },
    })
  }

  async findByAction(action: string, limit = 50, offset = 0): Promise<AuditLog[]> {
    return await this.auditLogRepository.find({
      where: { action: action as any },
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    })
  }

  async getAuditStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalLogs: number
    actionCounts: Record<string, number>
    severityCounts: Record<string, number>
    userCounts: Record<string, number>
    dailyCounts: Record<string, number>
  }> {
    const whereCondition: any = {}

    if (startDate && endDate) {
      whereCondition.createdAt = Between(startDate, endDate)
    }

    const logs = await this.auditLogRepository.find({
      where: whereCondition,
      order: { createdAt: "DESC" },
    })

    const actionCounts: Record<string, number> = {}
    const severityCounts: Record<string, number> = {}
    const userCounts: Record<string, number> = {}
    const dailyCounts: Record<string, number> = {}

    logs.forEach((log) => {
      // Count by action
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1

      // Count by severity
      severityCounts[log.severity] = (severityCounts[log.severity] || 0) + 1

      // Count by user
      userCounts[log.userId] = (userCounts[log.userId] || 0) + 1

      // Count by day
      const day = log.createdAt.toISOString().split("T")[0]
      dailyCounts[day] = (dailyCounts[day] || 0) + 1
    })

    return {
      totalLogs: logs.length,
      actionCounts,
      severityCounts,
      userCounts,
      dailyCounts,
    }
  }

  async findSuspiciousActivity(userId?: string): Promise<AuditLog[]> {
    const whereConditions: any = {
      severity: In(["HIGH", "CRITICAL"]),
    }

    if (userId) {
      whereConditions.userId = userId
    }

    return await this.auditLogRepository.find({
      where: whereConditions,
      order: { createdAt: "DESC" },
      take: 100,
    })
  }

  async deleteOldLogs(daysToKeep = 365): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const result = await this.auditLogRepository.delete({
      createdAt: Between(new Date("1970-01-01"), cutoffDate),
    })

    return result.affected || 0
  }
}
