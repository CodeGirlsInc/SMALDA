import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import { type ArchivePolicy, PolicyStatus } from "../entities/archive-policy.entity"
import { type ArchiveJob, JobStatus, JobType } from "../entities/archive-job.entity"
import type { ArchivingService } from "../archiving.service"

@Injectable()
export class ArchiveSchedulerService {
  private readonly logger = new Logger(ArchiveSchedulerService.name)
  private schedulerInterval: NodeJS.Timeout | null = null

  constructor(
    private archivePolicyRepository: Repository<ArchivePolicy>,
    private archiveJobRepository: Repository<ArchiveJob>,
    private archivingService: ArchivingService,
  ) {}

  async startScheduler(): Promise<void> {
    if (this.schedulerInterval) {
      this.logger.warn("Scheduler is already running")
      return
    }

    this.logger.log("Starting archive scheduler")

    // Run every hour
    this.schedulerInterval = setInterval(
      async () => {
        await this.evaluatePolicies()
      },
      60 * 60 * 1000,
    )

    // Run immediately on startup
    await this.evaluatePolicies()
  }

  async stopScheduler(): Promise<void> {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval)
      this.schedulerInterval = null
      this.logger.log("Archive scheduler stopped")
    }
  }

  async evaluatePolicies(): Promise<void> {
    this.logger.log("Evaluating archive policies")

    try {
      const activePolicies = await this.archivePolicyRepository.find({
        where: { isActive: true, status: PolicyStatus.ACTIVE },
        order: { priority: "DESC" },
      })

      for (const policy of activePolicies) {
        await this.processPolicyEvaluation(policy)
      }
    } catch (error) {
      this.logger.error(`Policy evaluation failed: ${error.message}`, error.stack)
    }
  }

  private async processPolicyEvaluation(policy: ArchivePolicy): Promise<void> {
    this.logger.log(`Evaluating policy: ${policy.name}`)

    try {
      // Create a policy evaluation job
      const job = this.archiveJobRepository.create({
        jobType: JobType.POLICY_EVALUATION,
        policyId: policy.id,
        jobParameters: {
          policyName: policy.name,
          documentType: policy.documentType,
          inactivityPeriodDays: policy.inactivityPeriodDays,
          conditions: policy.conditions,
        },
        scheduledAt: new Date(),
        triggeredBy: "scheduler",
        metadata: {
          policyId: policy.id,
          evaluationTime: new Date().toISOString(),
        },
      })

      const savedJob = await this.archiveJobRepository.save(job)
      await this.executeJob(savedJob)
    } catch (error) {
      this.logger.error(`Failed to process policy ${policy.name}: ${error.message}`, error.stack)
    }
  }

  async executeJob(job: ArchiveJob): Promise<void> {
    this.logger.log(`Executing job: ${job.id} (${job.jobType})`)

    // Update job status
    job.status = JobStatus.RUNNING
    job.startedAt = new Date()
    await this.archiveJobRepository.save(job)

    try {
      let result: any

      switch (job.jobType) {
        case JobType.POLICY_EVALUATION:
          result = await this.executePolicyEvaluation(job)
          break
        case JobType.ARCHIVE_DOCUMENTS:
          result = await this.executeArchiveDocuments(job)
          break
        case JobType.RESTORE_DOCUMENTS:
          result = await this.executeRestoreDocuments(job)
          break
        case JobType.CLEANUP_ARCHIVES:
          result = await this.executeCleanupArchives(job)
          break
        default:
          throw new Error(`Unknown job type: ${job.jobType}`)
      }

      // Update job with success
      job.status = JobStatus.COMPLETED
      job.completedAt = new Date()
      job.results = result
      job.documentsSucceeded = result.documentsProcessed || 0
    } catch (error) {
      this.logger.error(`Job execution failed: ${job.id}: ${error.message}`, error.stack)

      // Update job with failure
      job.status = JobStatus.FAILED
      job.completedAt = new Date()
      job.errorMessage = error.message
      job.errorDetails = { stack: error.stack }
    }

    await this.archiveJobRepository.save(job)
  }

  private async executePolicyEvaluation(job: ArchiveJob): Promise<any> {
    const { policyName, documentType, inactivityPeriodDays, conditions } = job.jobParameters

    // Find documents that meet archiving criteria
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - inactivityPeriodDays)

    // Mock document query - replace with actual document repository query
    const candidateDocuments = await this.findDocumentsForArchiving(documentType, cutoffDate, conditions)

    if (candidateDocuments.length > 0) {
      // Create archive job for these documents
      const archiveJob = this.archiveJobRepository.create({
        jobType: JobType.ARCHIVE_DOCUMENTS,
        policyId: job.policyId,
        jobParameters: {
          documentIds: candidateDocuments.map((doc) => doc.id),
          reason: "INACTIVE_PERIOD",
          policyName,
        },
        scheduledAt: new Date(),
        triggeredBy: "policy_evaluation",
        metadata: {
          parentJobId: job.id,
          policyName,
        },
      })

      await this.archiveJobRepository.save(archiveJob)
      await this.executeJob(archiveJob)
    }

    return {
      policyName,
      documentsEvaluated: candidateDocuments.length,
      documentsScheduledForArchiving: candidateDocuments.length,
      evaluationTime: new Date().toISOString(),
    }
  }

  private async executeArchiveDocuments(job: ArchiveJob): Promise<any> {
    const { documentIds, reason } = job.jobParameters

    let processed = 0
    let succeeded = 0
    let failed = 0
    const errors: string[] = []

    for (const documentId of documentIds) {
      try {
        await this.archivingService.archiveDocument(documentId, reason, "scheduler")
        succeeded++
      } catch (error) {
        failed++
        errors.push(`${documentId}: ${error.message}`)
        this.logger.error(`Failed to archive document ${documentId}: ${error.message}`)
      }
      processed++
    }

    job.documentsProcessed = processed
    job.documentsSucceeded = succeeded
    job.documentsFailed = failed

    return {
      documentsProcessed: processed,
      documentsSucceeded: succeeded,
      documentsFailed: failed,
      errors: errors.slice(0, 10), // Limit error details
    }
  }

  private async executeRestoreDocuments(job: ArchiveJob): Promise<any> {
    const { archivedDocumentIds } = job.jobParameters

    let processed = 0
    let succeeded = 0
    let failed = 0

    for (const archivedDocumentId of archivedDocumentIds) {
      try {
        await this.archivingService.restoreDocument(archivedDocumentId, "scheduler")
        succeeded++
      } catch (error) {
        failed++
        this.logger.error(`Failed to restore document ${archivedDocumentId}: ${error.message}`)
      }
      processed++
    }

    return {
      documentsProcessed: processed,
      documentsSucceeded: succeeded,
      documentsFailed: failed,
    }
  }

  private async executeCleanupArchives(job: ArchiveJob): Promise<any> {
    const { retentionPeriodDays } = job.jobParameters

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionPeriodDays)

    // Find archives older than retention period
    const expiredArchives = await this.archivingService.findExpiredArchives(cutoffDate)

    let processed = 0
    let succeeded = 0
    let failed = 0

    for (const archive of expiredArchives) {
      try {
        await this.archivingService.permanentlyDeleteArchive(archive.id)
        succeeded++
      } catch (error) {
        failed++
        this.logger.error(`Failed to delete expired archive ${archive.id}: ${error.message}`)
      }
      processed++
    }

    return {
      documentsProcessed: processed,
      documentsSucceeded: succeeded,
      documentsFailed: failed,
    }
  }

  private async findDocumentsForArchiving(documentType: string, cutoffDate: Date, conditions: any): Promise<any[]> {
    // Mock implementation - replace with actual document repository query
    // This should query your shipping_documents table for inactive documents

    const mockDocuments = [
      {
        id: "doc-1",
        documentType: "BILL_OF_LADING",
        updatedAt: new Date("2024-01-01"),
        status: "UPLOADED",
      },
      {
        id: "doc-2",
        documentType: "COMMERCIAL_INVOICE",
        updatedAt: new Date("2024-02-01"),
        status: "VALIDATED",
      },
    ]

    // Filter documents based on criteria
    return mockDocuments.filter((doc) => {
      if (documentType && doc.documentType !== documentType) return false
      if (doc.updatedAt > cutoffDate) return false
      return true
    })
  }

  async scheduleJob(
    jobType: JobType,
    parameters: Record<string, any>,
    scheduledAt?: Date,
    triggeredBy?: string,
  ): Promise<ArchiveJob> {
    const job = this.archiveJobRepository.create({
      jobType,
      jobParameters: parameters,
      scheduledAt: scheduledAt || new Date(),
      triggeredBy: triggeredBy || "manual",
    })

    const savedJob = await this.archiveJobRepository.save(job)

    // Execute immediately if scheduled for now or past
    if (!scheduledAt || scheduledAt <= new Date()) {
      this.executeJob(savedJob)
    }

    return savedJob
  }

  async getJobStatus(jobId: string): Promise<ArchiveJob> {
    const job = await this.archiveJobRepository.findOne({ where: { id: jobId } })
    if (!job) {
      throw new Error(`Job ${jobId} not found`)
    }
    return job
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = await this.getJobStatus(jobId)

    if (job.status === JobStatus.RUNNING) {
      throw new Error("Cannot cancel running job")
    }

    if (job.status === JobStatus.COMPLETED) {
      throw new Error("Cannot cancel completed job")
    }

    job.status = JobStatus.CANCELLED
    await this.archiveJobRepository.save(job)
  }
}
