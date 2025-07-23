import { Processor, Process } from "@nestjs/bull"
import type { Job } from "bull"
import { Injectable, Logger } from "@nestjs/common"
import type { ReportingService } from "../reporting.service"

@Injectable()
@Processor("report")
export class ReportProcessor {
  private readonly logger = new Logger(ReportProcessor.name)

  constructor(private readonly reportingService: ReportingService) {}

  @Process("generate-report")
  async handleGenerateReport(job: Job<{ reportId: string }>) {
    const { reportId } = job.data
    this.logger.log(`Processing report generation job for report: ${reportId}`)

    try {
      await this.reportingService.processReportGeneration(reportId)
      this.logger.log(`Successfully generated report: ${reportId}`)
    } catch (error) {
      this.logger.error(`Failed to generate report ${reportId}:`, error)
      throw error
    }
  }

  @Process("cleanup-expired")
  async handleCleanupExpired(job: Job) {
    this.logger.log("Processing expired reports cleanup job")

    try {
      const deletedCount = await this.reportingService.cleanupExpiredReports()
      this.logger.log(`Cleaned up ${deletedCount} expired reports`)
    } catch (error) {
      this.logger.error("Failed to cleanup expired reports:", error)
      throw error
    }
  }

  @Process("retry-failed")
  async handleRetryFailed(job: Job) {
    this.logger.log("Processing failed reports retry job")

    try {
      const retryCount = await this.reportingService.retryFailedReports()
      this.logger.log(`Queued ${retryCount} failed reports for retry`)
    } catch (error) {
      this.logger.error("Failed to retry failed reports:", error)
      throw error
    }
  }
}
