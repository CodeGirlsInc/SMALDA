import { Controller, Get, Post, Param, Query, Res, Delete, ParseUUIDPipe, UseGuards } from "@nestjs/common"
import type { Response } from "express"
import type { ReportingService } from "./reporting.service"
import type { GenerateReportDto } from "./dto/generate-report.dto"
import type { ReportQueryDto } from "./dto/report-query.dto"
import type { Report } from "./entities/report.entity"
import { AdminGuard, Roles } from "../admin/guards/admin.guard"
import { UserRole } from "../admin/entities/user.entity"

@Controller("reports")
@UseGuards(AdminGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Post("generate")
  async generateReport(generateReportDto: GenerateReportDto): Promise<Report> {
    return await this.reportingService.generateReport(generateReportDto)
  }

  @Get()
  async findAll(query: ReportQueryDto): Promise<{
    reports: Report[]
    total: number
    limit: number
    offset: number
  }> {
    return await this.reportingService.findAll(query)
  }

  @Get("statistics")
  async getStatistics(@Query("generatedBy") generatedBy?: string): Promise<{
    total: number
    byType: Record<string, number>
    byFormat: Record<string, number>
    byStatus: Record<string, number>
    totalDownloads: number
    averageFileSize: number
  }> {
    return await this.reportingService.getReportStatistics(generatedBy)
  }

  @Get(":id")
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<Report> {
    return await this.reportingService.findOne(id)
  }

  @Get(":id/download")
  async downloadReport(@Param("id", ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const { buffer, report } = await this.reportingService.downloadReport(id)

    const mimeTypes = {
      PDF: "application/pdf",
      CSV: "text/csv",
      EXCEL: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      JSON: "application/json",
    }

    res.set({
      "Content-Type": mimeTypes[report.format] || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${report.fileName}"`,
      "Content-Length": report.fileSize.toString(),
    })

    res.send(buffer)
  }

  @Delete(":id")
  async deleteReport(@Param("id", ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.reportingService.deleteReport(id)
    return { message: "Report deleted successfully" }
  }

  @Post("cleanup-expired")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async cleanupExpiredReports(): Promise<{ message: string; deletedCount: number }> {
    const deletedCount = await this.reportingService.cleanupExpiredReports()
    return { message: "Expired reports cleaned up", deletedCount }
  }

  @Post("retry-failed")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async retryFailedReports(): Promise<{ message: string; retryCount: number }> {
    const retryCount = await this.reportingService.retryFailedReports()
    return { message: "Failed reports queued for retry", retryCount }
  }
}
