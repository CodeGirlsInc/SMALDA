import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common"
import type { Repository } from "typeorm"
import { Between } from "typeorm"
import type { Queue } from "bull"
import type { Report } from "./entities/report.entity"
import { ReportStatus, ReportType, ReportFormat } from "./entities/report.entity"
import type { GenerateReportDto } from "./dto/generate-report.dto"
import type { ReportQueryDto } from "./dto/report-query.dto"
import type { DataAggregatorService } from "./services/data-aggregator.service"
import type { PdfGeneratorService } from "./services/pdf-generator.service"
import type { CsvGeneratorService } from "./services/csv-generator.service"
import * as fs from "fs"
import * as path from "path"

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name)
  private readonly reportsPath = "./uploads/reports"

  constructor(
    private reportRepository: Repository<Report>,
    private dataAggregatorService: DataAggregatorService,
    private pdfGeneratorService: PdfGeneratorService,
    private csvGeneratorService: CsvGeneratorService,
    private reportQueue: Queue,
  ) {
    // Ensure reports directory exists
    if (!fs.existsSync(this.reportsPath)) {
      fs.mkdirSync(this.reportsPath, { recursive: true })
    }
  }

  async generateReport(generateReportDto: GenerateReportDto): Promise<Report> {
    this.logger.log(`Generating report: ${generateReportDto.title}`)

    // Create report record
    const report = this.reportRepository.create({
      type: generateReportDto.type,
      format: generateReportDto.format,
      title: generateReportDto.title,
      description: generateReportDto.description,
      parameters: {
        startDate: generateReportDto.startDate,
        endDate: generateReportDto.endDate,
        documentIds: generateReportDto.documentIds,
        userIds: generateReportDto.userIds,
        riskLevel: generateReportDto.riskLevel,
        department: generateReportDto.department,
        additionalFilters: generateReportDto.additionalFilters,
      },
      generatedBy: generateReportDto.generatedBy,
      generatedByEmail: generateReportDto.generatedByEmail,
      status: ReportStatus.PENDING,
      metadata: generateReportDto.metadata,
      expiresAt: this.calculateExpirationDate(),
    })

    const savedReport = await this.reportRepository.save(report)

    // Queue report generation
    await this.reportQueue.add(
      "generate-report",
      { reportId: savedReport.id },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    )

    return savedReport
  }

  async processReportGeneration(reportId: string): Promise<void> {
    const report = await this.reportRepository.findOne({ where: { id: reportId } })
    if (!report) {
      throw new NotFoundException(`Report ${reportId} not found`)
    }

    try {
      // Update status to generating
      await this.updateReportStatus(reportId, ReportStatus.GENERATING)

      // Generate file name and path
      const fileName = `${report.type.toLowerCase()}_${Date.now()}.${report.format.toLowerCase()}`
      const filePath = path.join(this.reportsPath, fileName)

      // Generate report based on type
      await this.generateReportByType(report, filePath)

      // Update report with file information
      const fileStats = fs.statSync(filePath)
      await this.reportRepository.update(reportId, {
        status: ReportStatus.COMPLETED,
        filePath,
        fileName,
        fileSize: fileStats.size,
        downloadUrl: `/api/reports/${reportId}/download`,
      })

      this.logger.log(`Report generated successfully: ${fileName}`)
    } catch (error) {
      this.logger.error(`Failed to generate report ${reportId}:`, error)
      await this.updateReportStatus(reportId, ReportStatus.FAILED, error.message)
      throw error
    }
  }

  private async generateReportByType(report: Report, filePath: string): Promise<void> {
    const filters = {
      startDate: report.parameters.startDate ? new Date(report.parameters.startDate) : undefined,
      endDate: report.parameters.endDate ? new Date(report.parameters.endDate) : undefined,
      documentIds: report.parameters.documentIds,
      userIds: report.parameters.userIds,
      riskLevel: report.parameters.riskLevel,
      department: report.parameters.department,
      ...report.parameters.additionalFilters,
    }

    switch (report.type) {
      case ReportType.DOCUMENT_ANALYSIS:
        const docData = await this.dataAggregatorService.aggregateDocumentAnalysisData(filters)
        if (report.format === ReportFormat.PDF) {
          await this.pdfGeneratorService.generateDocumentAnalysisReport(docData, report.title, filePath)
        } else if (report.format === ReportFormat.CSV) {
          await this.csvGeneratorService.generateDocumentAnalysisReport(docData, filePath)
        }
        break

      case ReportType.RISK_SUMMARY:
        const riskData = await this.dataAggregatorService.aggregateRiskSummaryData(filters)
        if (report.format === ReportFormat.PDF) {
          await this.pdfGeneratorService.generateRiskSummaryReport(riskData, report.title, filePath)
        } else if (report.format === ReportFormat.CSV) {
          await this.csvGeneratorService.generateRiskSummaryReport(riskData, filePath)
        }
        break

      case ReportType.AUDIT_TRAIL:
        const auditData = await this.dataAggregatorService.aggregateAuditTrailData(filters)
        if (report.format === ReportFormat.PDF) {
          await this.pdfGeneratorService.generateAuditTrailReport(auditData, report.title, filePath)
        } else if (report.format === ReportFormat.CSV) {
          await this.csvGeneratorService.generateAuditTrailReport(auditData, filePath)
        }
        break

      case ReportType.USER_ACTIVITY:
        const userData = await this.dataAggregatorService.aggregateUserActivityData(filters)
        if (report.format === ReportFormat.PDF) {
          await this.pdfGeneratorService.generateUserActivityReport(userData, report.title, filePath)
        } else if (report.format === ReportFormat.CSV) {
          await this.csvGeneratorService.generateUserActivityReport(userData, filePath)
        }
        break

      case ReportType.SYSTEM_OVERVIEW:
        const systemData = await this.dataAggregatorService.aggregateSystemOverviewData()
        if (report.format === ReportFormat.PDF) {
          await this.pdfGeneratorService.generateSystemOverviewReport(systemData, report.title, filePath)
        } else if (report.format === ReportFormat.CSV) {
          await this.csvGeneratorService.generateSystemOverviewReport(systemData, filePath)
        }
        break

      case ReportType.COMPLIANCE:
        const complianceData = await this.dataAggregatorService.aggregateComplianceData(filters)
        if (report.format === ReportFormat.PDF) {
          await this.pdfGeneratorService.generateComplianceReport(complianceData, report.title, filePath)
        } else if (report.format === ReportFormat.CSV) {
          await this.csvGeneratorService.generateComplianceReport(complianceData, filePath)
        }
        break

      default:
        throw new BadRequestException(`Unsupported report type: ${report.type}`)
    }
  }

  async findAll(query: ReportQueryDto): Promise<{
    reports: Report[]
    total: number
    limit: number
    offset: number
  }> {
    const { type, format, status, generatedBy, startDate, endDate, limit = 50, offset = 0, search } = query

    const whereConditions: any = {}

    if (type) {
      whereConditions.type = type
    }

    if (format) {
      whereConditions.format = format
    }

    if (status) {
      whereConditions.status = status
    }

    if (generatedBy) {
      whereConditions.generatedBy = generatedBy
    }

    if (startDate && endDate) {
      whereConditions.createdAt = Between(new Date(startDate), new Date(endDate))
    }

    let queryBuilder = this.reportRepository.createQueryBuilder("report")

    // Apply where conditions
    Object.entries(whereConditions).forEach(([key, value]) => {
      if (key === "createdAt") {
        queryBuilder = queryBuilder.andWhere(`report.${key} BETWEEN :startDate AND :endDate`, {
          startDate: value.from,
          endDate: value.to,
        })
      } else {
        queryBuilder = queryBuilder.andWhere(`report.${key} = :${key}`, { [key]: value })
      }
    })

    // Apply search
    if (search) {
      queryBuilder = queryBuilder.andWhere("(report.title ILIKE :search OR report.description ILIKE :search)", {
        search: `%${search}%`,
      })
    }

    // Apply pagination and ordering
    queryBuilder = queryBuilder.orderBy("report.createdAt", "DESC").take(limit).skip(offset)

    const [reports, total] = await queryBuilder.getManyAndCount()

    return {
      reports,
      total,
      limit,
      offset,
    }
  }

  async findOne(id: string): Promise<Report> {
    const report = await this.reportRepository.findOne({ where: { id } })
    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`)
    }
    return report
  }

  async downloadReport(id: string): Promise<{ buffer: Buffer; report: Report }> {
    const report = await this.findOne(id)

    if (report.status !== ReportStatus.COMPLETED) {
      throw new BadRequestException("Report is not ready for download")
    }

    if (!report.filePath || !fs.existsSync(report.filePath)) {
      throw new NotFoundException("Report file not found")
    }

    // Check if report has expired
    if (report.expiresAt && report.expiresAt < new Date()) {
      throw new BadRequestException("Report has expired")
    }

    // Increment download count
    await this.reportRepository.increment({ id }, "downloadCount", 1)

    const buffer = fs.readFileSync(report.filePath)
    return { buffer, report }
  }

  async deleteReport(id: string): Promise<void> {
    const report = await this.findOne(id)

    // Delete file if it exists
    if (report.filePath && fs.existsSync(report.filePath)) {
      fs.unlinkSync(report.filePath)
    }

    // Delete from database
    await this.reportRepository.remove(report)
  }

  async getReportStatistics(generatedBy?: string): Promise<{
    total: number
    byType: Record<string, number>
    byFormat: Record<string, number>
    byStatus: Record<string, number>
    totalDownloads: number
    averageFileSize: number
  }> {
    const whereCondition: any = {}
    if (generatedBy) {
      whereCondition.generatedBy = generatedBy
    }

    const reports = await this.reportRepository.find({ where: whereCondition })

    const stats = {
      total: reports.length,
      byType: {} as Record<string, number>,
      byFormat: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      totalDownloads: 0,
      averageFileSize: 0,
    }

    let totalFileSize = 0

    reports.forEach((report) => {
      // Count by type
      stats.byType[report.type] = (stats.byType[report.type] || 0) + 1

      // Count by format
      stats.byFormat[report.format] = (stats.byFormat[report.format] || 0) + 1

      // Count by status
      stats.byStatus[report.status] = (stats.byStatus[report.status] || 0) + 1

      // Sum downloads and file sizes
      stats.totalDownloads += report.downloadCount
      totalFileSize += report.fileSize
    })

    stats.averageFileSize = reports.length > 0 ? totalFileSize / reports.length : 0

    return stats
  }

  async cleanupExpiredReports(): Promise<number> {
    const expiredReports = await this.reportRepository.find({
      where: {
        expiresAt: Between(new Date("1970-01-01"), new Date()),
        status: ReportStatus.COMPLETED,
      },
    })

    let deletedCount = 0
    for (const report of expiredReports) {
      try {
        // Delete file
        if (report.filePath && fs.existsSync(report.filePath)) {
          fs.unlinkSync(report.filePath)
        }

        // Update status to expired
        await this.reportRepository.update(report.id, {
          status: ReportStatus.EXPIRED,
          filePath: null,
          fileName: null,
          fileSize: 0,
        })

        deletedCount++
      } catch (error) {
        this.logger.error(`Failed to cleanup expired report ${report.id}:`, error)
      }
    }

    this.logger.log(`Cleaned up ${deletedCount} expired reports`)
    return deletedCount
  }

  async retryFailedReports(): Promise<number> {
    const failedReports = await this.reportRepository.find({
      where: { status: ReportStatus.FAILED },
    })

    let retryCount = 0
    for (const report of failedReports) {
      try {
        // Reset status to pending
        await this.updateReportStatus(report.id, ReportStatus.PENDING)

        // Requeue for generation
        await this.reportQueue.add(
          "generate-report",
          { reportId: report.id },
          {
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 5000,
            },
          },
        )

        retryCount++
      } catch (error) {
        this.logger.error(`Failed to retry report ${report.id}:`, error)
      }
    }

    this.logger.log(`Queued ${retryCount} failed reports for retry`)
    return retryCount
  }

  private async updateReportStatus(id: string, status: ReportStatus, errorMessage?: string): Promise<void> {
    const updateData: any = { status }
    if (errorMessage) {
      updateData.errorMessage = errorMessage
    }
    await this.reportRepository.update(id, updateData)
  }

  private calculateExpirationDate(): Date {
    const expirationDate = new Date()
    expirationDate.setDate(expirationDate.getDate() + 30) // Reports expire after 30 days
    return expirationDate
  }
}
