import { Controller, Get, Post, Body, Param, Query, ParseUUIDPipe } from "@nestjs/common"
import type { AuditLogService } from "./audit-log.service"
import type { CreateAuditLogDto } from "./dto/create-audit-log.dto"
import type { AuditLogQueryDto } from "./dto/audit-log-query.dto"
import type { AuditLog } from "./entities/audit-log.entity"

@Controller("audit-logs")
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Post()
  async createLog(createAuditLogDto: CreateAuditLogDto): Promise<AuditLog> {
    return await this.auditLogService.createLog(createAuditLogDto)
  }

  @Get()
  async findAll(@Query() query: AuditLogQueryDto): Promise<{
    logs: AuditLog[]
    total: number
    limit: number
    offset: number
  }> {
    return await this.auditLogService.findAll(query)
  }

  @Get("statistics")
  async getStatistics(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ): Promise<{
    totalLogs: number
    actionCounts: Record<string, number>
    severityCounts: Record<string, number>
    userCounts: Record<string, number>
    dailyCounts: Record<string, number>
  }> {
    const start = startDate ? new Date(startDate) : undefined
    const end = endDate ? new Date(endDate) : undefined
    return await this.auditLogService.getAuditStatistics(start, end)
  }

  @Get("suspicious")
  async findSuspiciousActivity(@Query("userId") userId?: string): Promise<AuditLog[]> {
    return await this.auditLogService.findSuspiciousActivity(userId)
  }

  @Get("user/:userId")
  async findByUser(
    @Param("userId") userId: string,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
  ): Promise<AuditLog[]> {
    return await this.auditLogService.findByUser(userId, limit, offset)
  }

  @Get("resource/:resourceType/:resourceId")
  async findByResource(
    @Param("resourceType") resourceType: string,
    @Param("resourceId", ParseUUIDPipe) resourceId: string,
  ): Promise<AuditLog[]> {
    return await this.auditLogService.findByResource(resourceType, resourceId)
  }

  @Get("action/:action")
  async findByAction(
    @Param("action") action: string,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
  ): Promise<AuditLog[]> {
    return await this.auditLogService.findByAction(action, limit, offset)
  }

  @Get(":id")
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<AuditLog | null> {
    return await this.auditLogService.findOne(id)
  }

  @Post("cleanup")
  async cleanupOldLogs(@Body() body: { daysToKeep: number }): Promise<{ deletedCount: number }> {
    const daysToKeep = body.daysToKeep || 365
    const deletedCount = await this.auditLogService.deleteOldLogs(daysToKeep)
    return { deletedCount }
  }
}
