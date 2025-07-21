import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common"
import type { Repository } from "typeorm"
import {
  type ArchivedDocument,
  type ArchivePolicy,
  type ArchiveJob,
  type ArchiveReason,
  ArchiveStatus,
  PolicyStatus,
} from "./entities/archived-document.entity"
import type {
  CreateArchivePolicyDto,
  UpdateArchivePolicyDto,
  ManualArchiveDto,
  RestoreDocumentDto,
  QueryArchivedDocumentsDto,
} from "./dto/archive.dto"
import type { ArchiveStorageService } from "./services/archive-storage.service"
import type { ArchiveSchedulerService } from "./services/archive-scheduler.service"

@Injectable()
export class ArchivingService {
  private readonly logger = new Logger(ArchivingService.name)

  constructor(
    private archivedDocumentRepository: Repository<ArchivedDocument>,
    private archivePolicyRepository: Repository<ArchivePolicy>,
    private archiveJobRepository: Repository<ArchiveJob>,
    private archiveStorageService: ArchiveStorageService,
    private archiveSchedulerService: ArchiveSchedulerService,
  ) {}

  async onModuleInit() {
    // Start the scheduler when the module initializes
    await this.archiveSchedulerService.startScheduler()
  }

  async onModuleDestroy() {
    // Stop the scheduler when the module is destroyed
    await this.archiveSchedulerService.stopScheduler()
  }

  // Archive Policy Management
  async createArchivePolicy(createDto: CreateArchivePolicyDto): Promise<ArchivePolicy> {
    this.logger.log(`Creating archive policy: ${createDto.name}`)

    const policy = this.archivePolicyRepository.create({
      ...createDto,
      status: PolicyStatus.ACTIVE,
      isActive: true,
    })

    return this.archivePolicyRepository.save(policy)
  }

  async updateArchivePolicy(id: string, updateDto: UpdateArchivePolicyDto): Promise<ArchivePolicy> {
    const policy = await this.archivePolicyRepository.findOne({ where: { id } })
    if (!policy) {
      throw new NotFoundException(`Archive policy ${id} not found`)
    }

    Object.assign(policy, updateDto)
    return this.archivePolicyRepository.save(policy)
  }

  async getArchivePolicies(): Promise<ArchivePolicy[]> {
    return this.archivePolicyRepository.find({
      order: { priority: "DESC", createdAt: "DESC" },
    })
  }

  async getArchivePolicy(id: string): Promise<ArchivePolicy> {
    const policy = await this.archivePolicyRepository.findOne({ where: { id } })
    if (!policy) {
      throw new NotFoundException(`Archive policy ${id} not found`)
    }
    return policy
  }

  async deleteArchivePolicy(id: string): Promise<void> {
    const policy = await this.getArchivePolicy(id)
    await this.archivePolicyRepository.remove(policy)
  }

  // Document Archiving
  async archiveDocument(documentId: string, reason: ArchiveReason, archivedBy?: string): Promise<ArchivedDocument> {
    this.logger.log(`Archiving document: ${documentId}`)

    // Mock: Get document data from original table
    // In real implementation, query your shipping_documents table
    const originalDocument = await this.getOriginalDocument(documentId)

    if (!originalDocument) {
      throw new NotFoundException(`Document ${documentId} not found`)
    }

    // Check if document is already archived
    const existingArchive = await this.archivedDocumentRepository.findOne({
      where: { originalDocumentId: documentId },
    })

    if (existingArchive) {
      throw new BadRequestException(`Document ${documentId} is already archived`)
    }

    try {
      // Store document in archive storage
      const storageResult = await this.archiveStorageService.archiveDocument(
        documentId,
        originalDocument,
        true, // compress
      )

      // Create archive record
      const archivedDocument = this.archivedDocumentRepository.create({
        originalDocumentId: documentId,
        originalTableName: "shipping_documents",
        originalDocumentData: originalDocument,
        archiveReason: reason,
        status: ArchiveStatus.ARCHIVED,
        documentType: originalDocument.documentType,
        shipmentId: originalDocument.shipmentId,
        uploadedBy: originalDocument.uploadedBy,
        archivedBy,
        archiveLocation: storageResult.archiveLocation,
        originalFileSize: storageResult.originalSize,
        compressionRatio: storageResult.compressionRatio,
        archiveMetadata: {
          checksum: storageResult.checksum,
          compressedSize: storageResult.compressedSize,
          archivedAt: new Date().toISOString(),
        },
      })

      const savedArchive = await this.archivedDocumentRepository.save(archivedDocument)

      // Remove from original table (mock)
      await this.removeFromOriginalTable(documentId)

      this.logger.log(`Document archived successfully: ${documentId}`)
      return savedArchive
    } catch (error) {
      this.logger.error(`Failed to archive document ${documentId}: ${error.message}`, error.stack)
      throw new BadRequestException(`Archive failed: ${error.message}`)
    }
  }

  async archiveMultipleDocuments(archiveDto: ManualArchiveDto): Promise<ArchivedDocument[]> {
    const results: ArchivedDocument[] = []
    const errors: string[] = []

    for (const documentId of archiveDto.documentIds) {
      try {
        const archived = await this.archiveDocument(documentId, archiveDto.reason, archiveDto.archivedBy)
        results.push(archived)
      } catch (error) {
        errors.push(`${documentId}: ${error.message}`)
        this.logger.error(`Failed to archive document ${documentId}: ${error.message}`)
      }
    }

    if (errors.length > 0) {
      this.logger.warn(`Some documents failed to archive: ${errors.join(", ")}`)
    }

    return results
  }

  // Document Restoration
  async restoreDocument(archivedDocumentId: string, restoredBy?: string): Promise<any> {
    this.logger.log(`Restoring document: ${archivedDocumentId}`)

    const archivedDocument = await this.archivedDocumentRepository.findOne({
      where: { id: archivedDocumentId },
    })

    if (!archivedDocument) {
      throw new NotFoundException(`Archived document ${archivedDocumentId} not found`)
    }

    if (archivedDocument.status !== ArchiveStatus.ARCHIVED) {
      throw new BadRequestException(`Document ${archivedDocumentId} is not in archived status`)
    }

    try {
      // Update status to restoring
      archivedDocument.status = ArchiveStatus.RESTORING
      await this.archivedDocumentRepository.save(archivedDocument)

      // Restore document data from archive storage
      const restoredData = await this.archiveStorageService.restoreDocument(
        archivedDocument.archiveLocation,
        archivedDocument.compressionRatio > 1,
      )

      // Restore to original table (mock)
      const restoredDocument = await this.restoreToOriginalTable(restoredData)

      // Update archive record
      archivedDocument.status = ArchiveStatus.RESTORED
      archivedDocument.restoredBy = restoredBy
      archivedDocument.restoredAt = new Date()
      await this.archivedDocumentRepository.save(archivedDocument)

      this.logger.log(`Document restored successfully: ${archivedDocumentId}`)
      return restoredDocument
    } catch (error) {
      // Revert status on failure
      archivedDocument.status = ArchiveStatus.ARCHIVED
      await this.archivedDocumentRepository.save(archivedDocument)

      this.logger.error(`Failed to restore document ${archivedDocumentId}: ${error.message}`, error.stack)
      throw new BadRequestException(`Restore failed: ${error.message}`)
    }
  }

  async restoreMultipleDocuments(restoreDto: RestoreDocumentDto): Promise<any[]> {
    const results: any[] = []
    const errors: string[] = []

    for (const archivedDocumentId of restoreDto.archivedDocumentIds) {
      try {
        const restored = await this.restoreDocument(archivedDocumentId, restoreDto.restoredBy)
        results.push(restored)
      } catch (error) {
        errors.push(`${archivedDocumentId}: ${error.message}`)
        this.logger.error(`Failed to restore document ${archivedDocumentId}: ${error.message}`)
      }
    }

    if (errors.length > 0) {
      this.logger.warn(`Some documents failed to restore: ${errors.join(", ")}`)
    }

    return results
  }

  // Query Methods
  async findArchivedDocuments(
    queryDto: QueryArchivedDocumentsDto,
  ): Promise<{ documents: ArchivedDocument[]; total: number }> {
    const {
      documentType,
      shipmentId,
      uploadedBy,
      archiveReason,
      status,
      archivedAfter,
      archivedBefore,
      limit,
      offset,
    } = queryDto

    const queryBuilder = this.archivedDocumentRepository.createQueryBuilder("archived_document")

    if (documentType) {
      queryBuilder.andWhere("archived_document.documentType = :documentType", { documentType })
    }

    if (shipmentId) {
      queryBuilder.andWhere("archived_document.shipmentId = :shipmentId", { shipmentId })
    }

    if (uploadedBy) {
      queryBuilder.andWhere("archived_document.uploadedBy = :uploadedBy", { uploadedBy })
    }

    if (archiveReason) {
      queryBuilder.andWhere("archived_document.archiveReason = :archiveReason", { archiveReason })
    }

    if (status) {
      queryBuilder.andWhere("archived_document.status = :status", { status })
    }

    if (archivedAfter) {
      queryBuilder.andWhere("archived_document.archivedAt >= :archivedAfter", { archivedAfter })
    }

    if (archivedBefore) {
      queryBuilder.andWhere("archived_document.archivedAt <= :archivedBefore", { archivedBefore })
    }

    queryBuilder.orderBy("archived_document.archivedAt", "DESC").skip(offset).take(limit)

    const [documents, total] = await queryBuilder.getManyAndCount()

    return { documents, total }
  }

  async findArchivedDocument(id: string): Promise<ArchivedDocument> {
    const document = await this.archivedDocumentRepository.findOne({ where: { id } })
    if (!document) {
      throw new NotFoundException(`Archived document ${id} not found`)
    }
    return document
  }

  async findExpiredArchives(cutoffDate: Date): Promise<ArchivedDocument[]> {
    return this.archivedDocumentRepository.find({
      where: {
        archivedAt: { $lt: cutoffDate } as any,
        status: ArchiveStatus.ARCHIVED,
      },
    })
  }

  async permanentlyDeleteArchive(archivedDocumentId: string): Promise<void> {
    const archivedDocument = await this.findArchivedDocument(archivedDocumentId)

    try {
      // Delete from archive storage
      await this.archiveStorageService.deleteArchivedDocument(archivedDocument.archiveLocation)

      // Mark as permanently deleted
      archivedDocument.status = ArchiveStatus.PERMANENTLY_DELETED
      archivedDocument.isPermanentlyDeleted = true
      archivedDocument.scheduledDeletionAt = new Date()

      await this.archivedDocumentRepository.save(archivedDocument)

      this.logger.log(`Archive permanently deleted: ${archivedDocumentId}`)
    } catch (error) {
      this.logger.error(`Failed to permanently delete archive ${archivedDocumentId}: ${error.message}`, error.stack)
      throw error
    }
  }

  // Statistics and Monitoring
  async getArchiveStats(): Promise<any> {
    const stats = await this.archivedDocumentRepository
      .createQueryBuilder("archived_document")
      .select([
        "archived_document.documentType as documentType",
        "archived_document.archiveReason as archiveReason",
        "archived_document.status as status",
        "COUNT(*) as count",
        "SUM(archived_document.originalFileSize) as totalSize",
        "AVG(archived_document.compressionRatio) as avgCompressionRatio",
      ])
      .groupBy("archived_document.documentType, archived_document.archiveReason, archived_document.status")
      .getRawMany()

    const storageStats = await this.archiveStorageService.getStorageStats()

    return {
      documentStats: stats,
      storageStats,
      totalArchived: stats.reduce((sum, stat) => sum + Number.parseInt(stat.count), 0),
    }
  }

  // Mock methods - replace with actual database operations
  private async getOriginalDocument(documentId: string): Promise<any> {
    // Mock implementation - replace with actual query to shipping_documents table
    return {
      id: documentId,
      originalName: "test-document.pdf",
      fileName: "test-document-123.pdf",
      filePath: "/uploads/test-document-123.pdf",
      mimeType: "application/pdf",
      fileSize: 1024000,
      documentType: "BILL_OF_LADING",
      status: "UPLOADED",
      shipmentId: "shipment-123",
      uploadedBy: "user-123",
      description: "Test document",
      metadata: {},
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-15"),
    }
  }

  private async removeFromOriginalTable(documentId: string): Promise<void> {
    // Mock implementation - replace with actual deletion from shipping_documents table
    this.logger.log(`Removed document ${documentId} from original table`)
  }

  private async restoreToOriginalTable(documentData: any): Promise<any> {
    // Mock implementation - replace with actual insertion to shipping_documents table
    this.logger.log(`Restored document ${documentData.id} to original table`)
    return documentData
  }
}
